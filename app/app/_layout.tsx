import '../global.css';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { colors } from '../theme/tokens';
import { motion } from '../theme/tokens';
import { useSession } from '../store/session';
import {
  ensureNotificationPermission,
  routeFromData,
  getInitialNotificationData,
  addNotificationTapListener,
} from '../lib/notifications';

// Keeps the visible route in sync with auth status wherever the user is — e.g.
// signing out from inside a tab must return them to login. index.tsx handles the
// initial cold-start redirect; this handles every status change afterwards.
function useAuthGuard() {
  const status = useSession((s) => s.status);
  const segments = useSegments() as string[];
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    // Admin is a second, separate auth branch (a real Supabase Auth session
    // with no `profiles` row) -- it must not be funneled through the student
    // onboarding/ready state machine, which would otherwise see "session but
    // no profile" and bounce it back to the student welcome screen.
    if (segments[0] === '(admin)') return;

    const inOnboarding = segments[0] === '(onboarding)';
    const atCompleteProfile = inOnboarding && segments[1] === 'complete-profile';
    const inAuthScreens =
      inOnboarding &&
      (segments[1] === 'welcome' ||
        segments[1] === 'amizone-login' ||
        segments[1] === 'amizone-webview');

    // Only enforce the onboarding boundary. A ready user is free to roam every
    // authed route (tabs, profile, ride, match, modal...) — just not onboarding.
    if (status === 'ready') {
      if (inOnboarding) router.replace('/(tabs)/passenger');
    } else if (status === 'incomplete') {
      if (!atCompleteProfile) router.replace('/(onboarding)/complete-profile');
    } else if (status === 'onboarding') {
      if (!inAuthScreens) router.replace('/(onboarding)/welcome');
    }
  }, [status, segments, router]);
}

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const hydrate = useSession((s) => s.hydrate);
  const subscribe = useSession((s) => s.subscribe);
  const profileId = useSession((s) => s.profile?.id);
  const status = useSession((s) => s.status);
  // True once expo-router's navigator has actually mounted. Routing before this
  // throws "navigate before mounting the Root Layout" — the cold-start-from-
  // notification crash.
  const navReady = !!useRootNavigationState()?.key;
  // Payload of a tapped notification awaiting a route. Held until the user is
  // authed ('ready') so a COLD-START tap (status still 'loading' at boot) isn't
  // dropped, and a tap never deep-links past the auth gate.
  const [pendingRoute, setPendingRoute] = useState<unknown>(null);

  useEffect(() => {
    hydrate();
    return subscribe();
  }, [hydrate, subscribe]);

  // #4: ask for notification permission as soon as a verified profile exists
  // (i.e. right after first login), not only at a later contextual moment — one
  // phone never got the contextual prompt and so never received pushes.
  // ensureNotificationPermission is a no-op once the choice is made, and
  // registers the token when granted.
  useEffect(() => {
    if (profileId) ensureNotificationPermission(profileId);
  }, [profileId]);

  // F7: capture taps (warm) + the launch notification (cold start). Routing is
  // deferred to the effect below, which waits for auth readiness.
  useEffect(() => {
    getInitialNotificationData().then((data) => {
      if (data) setPendingRoute(data);
    });
    return addNotificationTapListener((data) => setPendingRoute(data));
  }, []);

  // Flush a pending route once authed AND the navigator has mounted; drop it if
  // the session resolves to a non-ready state (a push only ever targets an
  // authed user). Waiting on navReady prevents a cold-start tap from routing
  // before the Root Layout mounts (a hard crash).
  useEffect(() => {
    if (!pendingRoute) return;
    if (status === 'loading' || !navReady) return; // keep it queued
    if (status === 'ready') routeFromData(pendingRoute);
    setPendingRoute(null);
  }, [status, pendingRoute, navReady]);

  useAuthGuard();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardProvider>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <QueryClientProvider client={queryClient}>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                // Soft fade + subtle upward slide between screens.
                animation: 'fade_from_bottom',
                animationDuration: motion.base,
              }}
            />
          </QueryClientProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
