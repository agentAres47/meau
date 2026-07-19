import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { supabase } from './supabase';

// Phase 1 (F7) — client side of push. Primitives only; the root layout wires the
// side-effects (register on profile, route on tap) so this module stays free of
// store imports (avoids a cycle: session.ts imports unregisterPushToken here).
//
// Push only works on a physical device with a dev/standalone build. In Expo Go
// (SDK 53+) remote push is unavailable and getExpoPushTokenAsync throws — every
// path degrades silently, so the app stays fully usable without push, with
// Realtime as the in-app fallback.

// Android channel id used by both registration (creates it) and outgoing pushes
// (services/matching/src/notify.ts sets `channelId: 'default'`). Keep in sync.
export const ANDROID_CHANNEL = 'default';

// Foreground presentation: show a banner + sound even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const projectId =
  Constants.expoConfig?.extra?.eas?.projectId ??
  (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;

// Remember this device's token so logout can delete exactly this row (not every
// device the user owns). Set on register, cleared on unregister.
let lastRegisteredToken: string | null = null;

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

// Get + persist this device's Expo push token. Only proceeds if permission is
// ALREADY granted — never prompts (that's ensureNotificationPermission's job).
// Idempotent on (profile_id, expo_push_token).
export async function registerPushToken(profileId: string): Promise<void> {
  if (!Device.isDevice) return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  if (!projectId) return;

  await ensureAndroidChannel();

  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return; // offline / Expo Go — non-fatal
  }
  lastRegisteredToken = token;

  await supabase
    .from('push_tokens')
    .upsert(
      { profile_id: profileId, expo_push_token: token, updated_at: new Date().toISOString() },
      { onConflict: 'profile_id,expo_push_token' }
    );
}

// Remove THIS device's token for the given profile. Must run while the session
// is still valid (RLS is owner-scoped), i.e. before supabase.auth.signOut().
// Without this, a shared device that later signs in as someone else would keep
// delivering the previous user's private notifications to the new user.
export async function unregisterPushToken(profileId: string): Promise<void> {
  let token = lastRegisteredToken;
  if (!token) {
    // Not cached (token was registered in a previous app run). Best-effort fetch.
    if (!Device.isDevice || !projectId) return;
    try {
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch {
      return;
    }
  }
  await supabase.from('push_tokens').delete().eq('profile_id', profileId).eq('expo_push_token', token);
  lastRegisteredToken = null;
}

// Ask for permission at a contextual moment (first match), then register. No-op
// if already decided (granted -> register; denied -> respect it).
export async function ensureNotificationPermission(profileId: string): Promise<void> {
  if (!Device.isDevice) return;
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted' && current.canAskAgain) {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status === 'granted') await registerPushToken(profileId);
}

// Map a notification's data payload to a route. Unknown types are ignored, so an
// older client tolerates a newer payload (forward-compatible).
export function routeFromData(data: unknown): void {
  if (!data || typeof data !== 'object') return;
  const d = data as { type?: string; matchId?: string; request_id?: string };
  if (d.type === 'chat' && d.matchId) router.push(`/match/${d.matchId}`);
  else if (d.type === 'match' && d.matchId) router.push(`/ride/matched/${d.matchId}`);
  else if (d.type === 'driver_incoming') router.push('/(tabs)/driver');
}

// Cold start: the data of the notification the app was launched from, if any.
export async function getInitialNotificationData(): Promise<unknown | null> {
  const response = await Notifications.getLastNotificationResponseAsync();
  return response?.notification.request.content.data ?? null;
}

// Warm taps while the app is running. The caller decides WHEN to route (it must
// gate on auth readiness), so this just forwards the payload.
export function addNotificationTapListener(onTap: (data: unknown) => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    onTap(response.notification.request.content.data);
  });
  return () => sub.remove();
}
