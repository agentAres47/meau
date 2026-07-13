import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Search, CheckCircle2 } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import {
  getRequestState,
  subscribeRequest,
  getDriverProfile,
  getMatchId,
  cancelRequest,
  type MatchedDriver,
} from '../../lib/passenger';

export default function Waiting() {
  const { rid } = useLocalSearchParams<{ rid: string }>();
  const [matched, setMatched] = useState(false);
  const [driver, setDriver] = useState<MatchedDriver | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const done = useRef(false);

  const refetch = useCallback(async () => {
    if (!rid) return;
    const s = await getRequestState(rid);
    if (!s) return;
    if (s.status === 'matched' && s.matched_driver_id && !done.current) {
      done.current = true;
      setMatched(true);
      setDriver(await getDriverProfile(s.matched_driver_id));
      setMatchId(await getMatchId(rid));
    }
  }, [rid]);

  useEffect(() => {
    if (!rid) return;
    refetch();
    return subscribeRequest(rid, refetch);
  }, [rid, refetch]);

  async function onCancel() {
    if (rid) await cancelRequest(rid);
    router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-bg items-center justify-center px-6" edges={['top', 'bottom']}>
      {matched ? (
        <View className="items-center gap-5 w-full">
          <CheckCircle2 color={colors.success} size={56} />
          <Text className="text-text text-xl font-bold">Matched!</Text>
          <View className="items-center gap-2">
            <Avatar name={driver?.full_name || 'Driver'} uri={driver?.photo_url} size={64} />
            <Text className="text-text text-base font-semibold">{driver?.full_name || 'Your driver'}</Text>
            <Text className="text-muted text-sm">is picking you up.</Text>
          </View>
          {matchId ? (
            <Button
              label="Message driver"
              onPress={() => router.replace(`/match/${matchId}`)}
              className="w-full"
            />
          ) : null}
          <Button label="Done" variant="secondary" onPress={() => router.back()} className="w-full" />
        </View>
      ) : (
        <View className="items-center gap-6">
          <Radar />
          <View className="items-center gap-1">
            <Text className="text-text text-lg font-bold">Finding your ride…</Text>
            <Text className="text-muted text-sm">Waiting for a driver to accept.</Text>
          </View>
          <Button label="Cancel" variant="ghost" onPress={onCancel} />
        </View>
      )}
    </SafeAreaView>
  );
}

function Radar() {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
  }, [p]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: 0.6 + p.value }], opacity: 1 - p.value }));

  return (
    <View className="w-32 h-32 items-center justify-center">
      <Animated.View style={ring} className="absolute w-32 h-32 rounded-full bg-accentSoft" />
      <View className="w-16 h-16 rounded-full bg-accentSoft items-center justify-center">
        <Search color={colors.accent} size={26} />
      </View>
    </View>
  );
}
