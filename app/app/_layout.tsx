import '../global.css';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { colors } from '../theme/tokens';
import { useSession } from '../store/session';

// Keeps the visible route in sync with auth status wherever the user is — e.g.
// signing out from inside a tab must return them to login. index.tsx handles the
// initial cold-start redirect; this handles every status change afterwards.
function useAuthGuard() {
  const status = useSession((s) => s.status);
  const segments = useSegments() as string[];
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

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

  useEffect(() => {
    hydrate();
    return subscribe();
  }, [hydrate, subscribe]);

  useAuthGuard();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.bg },
              animation: 'fade',
            }}
          />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
