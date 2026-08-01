import { useEffect } from 'react';
import { View, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Car, Search, Users, type LucideIcon } from 'lucide-react-native';
import { colors, motion, spacing } from '../theme/tokens';
import { DarkGlass } from './DarkGlass';
import { useDriverLive } from '../store/driverLive';
import { warningHaptic } from '../lib/haptics';

const META: Record<string, { icon: LucideIcon; label: string }> = {
  driver: { icon: Car, label: 'Driver' },
  passenger: { icon: Search, label: 'Passenger' },
  autopool: { icon: Users, label: 'Auto Pool' },
};

// Exported so screens with a floating CTA near the bottom (e.g. the passenger
// home's bottom sheet) can compute exactly how much clearance the dock needs,
// instead of guessing a padding number that drifts out of sync.
export const DOCK_MARGIN = spacing.xl; // gap above the safe-area bottom inset
export const DOCK_HEIGHT = 52; // rendered height: py-1.5 padding + icon + label

// Floating glass dock — Apple-inspired, not a full-width Material bar. No
// pill/capsule behind the active tab (that read as "an unnecessary inner
// rectangle" per design feedback) — active state is color + a small, timing-
// based (never spring-based, so it structurally cannot overshoot) icon scale.
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  // While live as a driver, the other tabs are locked (see store/driverLive).
  const live = useDriverLive((s) => s.live);

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + DOCK_MARGIN }}
      className="px-6"
    >
      {/* Dark-glass dock (macOS-style but translucent, not flat) — a dark,
          mostly-opaque tint that still carries the sheen highlight, so it
          floats above the map without the map showing through unevenly. */}
      {/* radius 999 clamps to half the height = a true pill, so the ends are
          exact semicircles. A fixed 28 left the sides visibly straight. */}
      <DarkGlass className="flex-row items-center px-2 py-1.5" radius={999}>
        {state.routes.map((route, i) => {
          const meta = META[route.name];
          if (!meta) return null;
          const focused = state.index === i;
          const locked = live && route.name !== 'driver';

          function onPress() {
            if (locked) {
              warningHaptic();
              return;
            }
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          }

          return (
            <TabButton
              key={route.key}
              icon={meta.icon}
              label={meta.label}
              focused={focused}
              locked={locked}
              onPress={onPress}
            />
          );
        })}
      </DarkGlass>
    </View>
  );
}

function TabButton({
  icon: Icon,
  label,
  focused,
  locked,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  focused: boolean;
  locked: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const color = focused ? colors.accent : colors.muted;

  useEffect(() => {
    scale.value = withTiming(focused ? 1.08 : 1, { duration: motion.fast, easing: Easing.out(Easing.cubic) });
  }, [focused, scale]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: focused, disabled: locked }}
      className="flex-1 items-center justify-center py-1.5 gap-1"
      style={{ opacity: locked ? 0.35 : 1 }}
    >
      <Animated.View style={iconStyle}>
        <Icon color={color} size={20} />
      </Animated.View>
      <Text style={{ color }} className={`text-[11px] ${focused ? 'font-semibold' : 'font-medium'}`}>
        {label}
      </Text>
    </Pressable>
  );
}
