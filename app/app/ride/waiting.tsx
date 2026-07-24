import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { SleepingCat } from '../../components/SleepingCat';
import { getRequestState, subscribeRequest, getMatchId, cancelRequest } from '../../lib/passenger';
import { matchHaptic } from '../../lib/haptics';

// Bug 6: rotate lightweight status lines so the wait reads as progress, not a
// hang. No redesign — same Radar + text, just a cycling subtitle.
const SEARCH_STEPS = [
  'Searching nearby drivers…',
  'Checking routes…',
  'Finding the best match…',
];

export default function Waiting() {
  const { rid, n } = useLocalSearchParams<{ rid: string; n?: string }>();
  const count = n ? parseInt(n, 10) : 0;
  const done = useRef(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % SEARCH_STEPS.length), 2200);
    return () => clearInterval(t);
  }, []);

  // On match, jump straight to the shared matched-ride screen (same one the
  // driver sees) instead of showing our own "Matched!" card here.
  const refetch = useCallback(async () => {
    if (!rid) return;
    const s = await getRequestState(rid);
    if (!s) return;
    if (s.status === 'matched' && s.matched_driver_id && !done.current) {
      done.current = true;
      matchHaptic();
      const matchId = await getMatchId(rid);
      if (matchId) router.replace(`/ride/matched/${matchId}`);
      return;
    }
    // Terminal without a match (BUG 2): every targeted driver declined, or the
    // request timed out. done.current is set on self-cancel below, so this only
    // fires for a passive passenger whose search failed.
    if ((s.status === 'cancelled' || s.status === 'expired') && !done.current) {
      done.current = true;
      Alert.alert('No ride found', 'No driver was available. Please try again.', [
        { text: 'OK', onPress: () => router.dismissTo('/(tabs)/passenger') },
      ]);
    }
  }, [rid]);

  useEffect(() => {
    if (!rid) return;
    refetch();
    return subscribeRequest(rid, refetch);
  }, [rid, refetch]);

  // dismissTo, not back(): this screen is commonly reached via a Redirect
  // (from the passenger tab's active-request gate), which replaces history
  // rather than pushing, so back() here can have nowhere to go. dismissTo also
  // unwinds the `ride` stack cleanly (plain replace left it resurfacing later).
  async function onCancel() {
    // Suppress the "No ride found" alert for our OWN cancel (both set 'cancelled').
    done.current = true;
    if (rid) await cancelRequest(rid);
    router.dismissTo('/(tabs)/passenger');
  }

  return (
    <Screen className="items-center justify-center px-6" edges={['top', 'bottom']}>
      <View className="items-center gap-6">
        <SleepingCat />
        <View className="items-center gap-1">
          <Text className="text-text text-lg font-bold">
            {count > 1 ? `Asked ${count} drivers…` : 'Finding your ride…'}
          </Text>
          <Text className="text-muted text-sm">{SEARCH_STEPS[step]}</Text>
        </View>
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </Screen>
  );
}
