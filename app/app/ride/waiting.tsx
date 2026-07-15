import { useCallback, useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Radar } from '../../components/Radar';
import { getRequestState, subscribeRequest, getMatchId, cancelRequest } from '../../lib/passenger';
import { matchHaptic } from '../../lib/haptics';

export default function Waiting() {
  const { rid } = useLocalSearchParams<{ rid: string }>();
  const done = useRef(false);

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
    }
  }, [rid]);

  useEffect(() => {
    if (!rid) return;
    refetch();
    return subscribeRequest(rid, refetch);
  }, [rid, refetch]);

  // router.replace, not back() — this screen is commonly reached via a
  // Redirect (from the passenger tab's active-request gate), which replaces
  // history rather than pushing, so back() here can have nowhere to go.
  async function onCancel() {
    if (rid) await cancelRequest(rid);
    router.replace('/(tabs)/passenger');
  }

  return (
    <Screen className="items-center justify-center px-6" edges={['top', 'bottom']}>
      <View className="items-center gap-6">
        <Radar />
        <View className="items-center gap-1">
          <Text className="text-text text-lg font-bold">Finding your ride…</Text>
          <Text className="text-muted text-sm">Waiting for a driver to accept.</Text>
        </View>
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </Screen>
  );
}
