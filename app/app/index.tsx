import { ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { colors } from '../theme/tokens';
import { Screen } from '../components/Screen';
import { useSession } from '../store/session';
import { resolveResumeHref } from '../lib/resume';

// Session gate (04-APP-STRUCTURE.md). Reads auth/profile status and redirects.
export default function Index() {
  const status = useSession((s) => s.status);
  const profileId = useSession((s) => s.profile?.id);
  // #2 — where a ready user lands. `undefined` = still resolving the restore;
  // `null` = nothing to restore (default home); a string = restore href.
  // Covers a pool/match in progress AND a live posted ride (see lib/resume) —
  // killing the app mid-ride used to relaunch onto Passenger as if nothing was
  // live. A notification launch still wins — the root layout's pending-route
  // flush runs after this and replaces the target.
  const [restore, setRestore] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (status !== 'ready' || !profileId) {
      setRestore(null);
      return;
    }
    let alive = true;
    resolveResumeHref(profileId)
      .then((href) => {
        if (alive) setRestore(href);
      })
      // Never strand the user on the loader because a restore lookup failed —
      // fall through to the default home.
      .catch(() => {
        if (alive) setRestore(null);
      });
    return () => {
      alive = false;
    };
  }, [status, profileId]);

  if (status === 'loading') return <Loader />;
  if (status === 'onboarding') return <Redirect href="/(onboarding)/welcome" />;
  if (status === 'incomplete') return <Redirect href="/(onboarding)/complete-profile" />;
  if (restore === undefined) return <Loader />; // resolving where to resume
  return <Redirect href={restore ?? '/(tabs)/passenger'} />;
}

function Loader() {
  return (
    <Screen edges={[]} className="items-center justify-center">
      <ActivityIndicator color={colors.accent} />
    </Screen>
  );
}
