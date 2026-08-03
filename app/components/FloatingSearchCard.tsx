import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Circle, MapPin } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { PlaceRow } from './PlaceRow';
import { DarkGlass } from './DarkGlass';
import { colors } from '../theme/tokens';
import { useSession } from '../store/session';
import { useReducedMotion } from '../lib/reducedMotion';

type Props = {
  title?: string;
  pickupLabel?: string;
  dropLabel?: string;
  onPressPickup: () => void;
  onPressDrop: () => void;
  // While a search is running the card stops being an input and becomes the
  // status of that input: rows go inert, a hairline travels its bottom edge.
  // The route you typed is still right there — it never leaves the screen.
  scanning?: boolean;
};

// The floating glass entry point for the map-first home screen: greeting +
// avatar, then the pickup/drop rows that open the existing location-picker
// modal (unchanged navigation — see REDESIGN_PLAN's "don't rewrite nav"
// constraint). Reused as-is by the Driver tab (title="Post a ride") so both
// roles share the literal same pickup/drop UI, not a lookalike duplicate.
export function FloatingSearchCard({
  title = 'Find a ride',
  pickupLabel,
  dropLabel,
  onPressPickup,
  onPressDrop,
  scanning = false,
}: Props) {
  const profile = useSession((s) => s.profile);

  return (
    <DarkGlass className="p-3 gap-2" radius={24}>
      <View className="flex-row items-center justify-between px-1">
        <Text className="text-muted text-xs">{title}</Text>
        <Pressable
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          className="active:opacity-70"
        >
          <Avatar name={profile?.full_name ?? 'Meau'} uri={profile?.photo_url} size={32} />
        </Pressable>
      </View>
      <View pointerEvents={scanning ? 'none' : 'auto'} style={{ opacity: scanning ? 0.72 : 1 }}>
        <PlaceRow
          icon={<Circle color={colors.accent} size={14} />}
          label="Pickup"
          value={pickupLabel}
          onPress={onPressPickup}
        />
        <View className="h-px bg-glassBorder ml-7 my-2" />
        <PlaceRow
          icon={<MapPin color={colors.success} size={16} />}
          label="Drop"
          value={dropLabel}
          onPress={onPressDrop}
        />
      </View>
      <ScanLine active={scanning} />
    </DarkGlass>
  );
}

// A hairline crossing the card's bottom edge — the smallest possible "this
// input is currently being worked on". Clipped by DarkGlass's own overflow,
// so it reads as light moving under the glass rather than a progress bar: it
// never fills, never completes, and communicates activity only.
function ScanLine({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const travel = useSharedValue(0);
  const fade = useSharedValue(0);

  useEffect(() => {
    fade.value = withTiming(active ? 1 : 0, { duration: active ? 320 : 240 });
  }, [active, fade]);

  useEffect(() => {
    if (!active || reduced) return;
    travel.value = 0;
    travel.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }), -1, false);
  }, [active, reduced, travel]);

  const style = useAnimatedStyle(() => ({
    opacity: fade.value * (reduced ? 0.5 : 1),
    transform: [{ translateX: -width * 0.45 + travel.value * width * 1.45 }],
  }));

  return (
    <View
      pointerEvents="none"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, overflow: 'hidden' }}
    >
      <Animated.View
        style={[
          { width: width * 0.45, height: 2, borderRadius: 2, backgroundColor: colors.accent },
          style,
        ]}
      />
    </View>
  );
}
