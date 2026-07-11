import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

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

async function fetchProfile(authUserId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  return (data as Profile) ?? null;
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

  hydrate: async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    const profile = session ? await fetchProfile(session.user.id) : null;
    set({ session, profile, status: deriveStatus(session, profile) });
  },

  // Keep the store in sync with Supabase auth changes (token refresh, sign-out).
  subscribe: () => {
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const profile = session ? await fetchProfile(session.user.id) : null;
      set({ session, profile, status: deriveStatus(session, profile) });
    });
    return () => data.subscription.unsubscribe();
  },

  refreshProfile: async () => {
    const { session } = get();
    const profile = session ? await fetchProfile(session.user.id) : null;
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
    await supabase.auth.signOut();
    set({ session: null, profile: null, status: 'onboarding' });
  },
}));
