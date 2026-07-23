import { ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { colors } from '../theme/tokens';
import { Screen } from '../components/Screen';
import { useSession } from '../store/session';
import { resumeHref } from '../lib/autopool';

// Session gate (04-APP-STRUCTURE.md). Reads auth/profile status and redirects.
export default function Index() {
  const status = useSession((s) => s.status);
  const profileId = useSession((s) => s.profile?.id);
  // #2 — where a ready user lands. `undefined` = still resolving an active-pool
  // restore; `null` = nothing to restore (default home); a string = restore href.
  // Fixes: app killed mid-pool relaunched to home instead of the pool.
  // ponytail: autopool only for now (the reported case); a directed-ride resume
  // can slot in the same way later. A notification launch still wins — the root
  // layout's pending-route flush runs after this and replaces the target.
  const [restore, setRestore] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (status !== 'ready' || !profileId) {
      setRestore(null);
      return;
    }
    let alive = true;
    resumeHref(profileId).then((href) => {
      if (alive) setRestore(href);
    });
    return () => {
      alive = false;
    };
  }, [status, profileId]);

  if (status === 'loading') return <Loader />;
  if (status === 'onboarding') return <Redirect href="/(onboarding)/welcome" />;
  if (status === 'incomplete') return <Redirect href="/(onboarding)/complete-profile" />;
  if (restore === undefined) return <Loader />; // resolving the active-pool restore
  return <Redirect href={restore ?? '/(tabs)/passenger'} />;
}

function Loader() {
  return (
    <Screen edges={[]} className="items-center justify-center">
      <ActivityIndicator color={colors.accent} />
    </Screen>
  );
}
