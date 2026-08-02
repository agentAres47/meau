import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { logDbError } from '../lib/dbError';
import { unregisterPushToken } from '../lib/notifications';

export type Profile = {
  id: string;
  auth_user_id: string;
  amizone_id: string;
  full_name: string;
  role: 'student' | 'faculty' | 'staff';
  batch: string | null;
  department: string | null;
  phone: string | null;
  gender: string | null;
  photo_url: string | null;
  is_driver_verified: boolean;
  verified_amity: boolean;
};

// Drives the session gate in app/index.tsx.
// - onboarding: no session, or a session with no verified profile yet → welcome
// - incomplete: verified profile exists but onboarding not finished (no phone)
// - ready:      fully onboarded → tabs
export type Status = 'loading' | 'onboarding' | 'incomplete' | 'ready';

function deriveStatus(session: Session | null, profile: Profile | null): Status {
  if (!session || !profile) return 'onboarding';
  if (!profile.phone) return 'incomplete';
  return 'ready';
}

// `ok: false` means "we could not find out", which is NOT the same as "this
// user has no profile" — and the difference matters a lot here. deriveStatus
// maps a missing profile to 'onboarding', so swallowing an error used to bounce
// a fully onboarded user to the welcome screen on nothing worse than a network
// blip. Since the Amizone WebView signs out on mount, that then forced a real
// re-login. Retry briefly first: this failure is almost always transient.
async function fetchProfile(authUserId: string): Promise<{ profile: Profile | null; ok: boolean }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (!error) return { profile: (data as Profile) ?? null, ok: true };
    logDbError(`fetchProfile attempt ${attempt + 1}`, error);
    if (attempt < 2) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
  }
  return { profile: null, ok: false };
}

type SessionState = {
  session: Session | null;
  profile: Profile | null;
  status: Status;
  hydrate: () => Promise<void>;
  subscribe: () => () => void;
  refreshProfile: () => Promise<void>;
  ensureSession: () => Promise<string>;
  signOut: () => Promise<void>;
};

export const useSession = create<SessionState>((set, get) => ({
  session: null,
  profile: null,
  status: 'loading',

  // On a failed lookup, keep whatever profile we already had rather than
  // downgrading to 'onboarding' — see fetchProfile. With no cached profile
  // (cold start) there is nothing better to do than fall through, but the
  // retries inside fetchProfile make that path rare.
  hydrate: async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) {
      set({ session: null, profile: null, status: deriveStatus(null, null) });
      return;
    }
    const res = await fetchProfile(session.user.id);
    const profile = res.ok ? res.profile : get().profile;
    set({ session, profile, status: deriveStatus(session, profile) });
  },

  // Keep the store in sync with Supabase auth changes (token refresh, sign-out).
  subscribe: () => {
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        set({ session: null, profile: null, status: deriveStatus(null, null) });
        return;
      }
      const res = await fetchProfile(session.user.id);
      const profile = res.ok ? res.profile : get().profile;
      set({ session, profile, status: deriveStatus(session, profile) });
    });
    return () => data.subscription.unsubscribe();
  },

  refreshProfile: async () => {
    const { session } = get();
    if (!session) {
      set({ profile: null, status: deriveStatus(null, null) });
      return;
    }
    const res = await fetchProfile(session.user.id);
    const profile = res.ok ? res.profile : get().profile;
    set({ profile, status: deriveStatus(session, profile) });
  },

  // Returns an access token for the current session, creating an anonymous one
  // if needed. Reused across relaunches (persisted in AsyncStorage) so we don't
  // churn anonymous users.
  ensureSession: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session.access_token;
    const { data: signIn, error } = await supabase.auth.signInAnonymously();
    if (error || !signIn.session) throw new Error('Could not start a session.');
    set({ session: signIn.session });
    return signIn.session.access_token;
  },

  signOut: async () => {
    // Shed THIS device's push token first (while the session still satisfies the
    // owner-scoped RLS) so a shared device signing in as someone else later
    // doesn't keep delivering this user's private notifications. Best-effort.
    const { profile } = get();
    if (profile) await unregisterPushToken(profile.id).catch(() => {});
    await supabase.auth.signOut();
    set({ session: null, profile: null, status: 'onboarding' });
  },
}));
