import { useCallback, useEffect, useRef } from 'react';
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
import { Search } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { getRequestState, subscribeRequest, getMatchId, cancelRequest } from '../../lib/passenger';

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
    <SafeAreaView className="flex-1 bg-bg items-center justify-center px-6" edges={['top', 'bottom']}>
      <View className="items-center gap-6">
        <Radar />
        <View className="items-center gap-1">
          <Text className="text-text text-lg font-bold">Finding your ride…</Text>
          <Text className="text-muted text-sm">Waiting for a driver to accept.</Text>
        </View>
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
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
