import { useEffect } from 'react';
import { View, Pressable, Text, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Car, Search, Users, type LucideIcon } from 'lucide-react-native';
import { Glass } from './Glass';
import { colors, motion } from '../theme/tokens';

const META: Record<string, { icon: LucideIcon; label: string }> = {
  driver: { icon: Car, label: 'Driver' },
  passenger: { icon: Search, label: 'Passenger' },
  autopool: { icon: Users, label: 'Auto Pool' },
};

const DOCK_MARGIN = 20; // gap above the safe-area bottom inset
const HIGHLIGHT_WIDTH = 44; // active-tab highlight sized to the icon, not the label
const HIGHLIGHT_HEIGHT = 30;

// Floating glass dock — Apple-inspired, not a full-width Material bar.
// Rendered absolutely positioned (reserves no layout height), so the three
// (tabs) screens carry their own bottom padding to clear it. The active tab
// gets a small neutral highlight behind its icon only, never a large colored
// pill — accent color is reserved for the active icon/label text.
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const count = state.routes.length;
  const width = useSharedValue(0);
  const index = useSharedValue(state.index);

  useEffect(() => {
    index.value = withSpring(state.index, motion.spring);
  }, [state.index, index]);

  const highlightStyle = useAnimatedStyle(() => {
    const slot = width.value / count;
    return {
      transform: [{ translateX: index.value * slot + (slot - HIGHLIGHT_WIDTH) / 2 }],
    };
  });

  function onLayout(e: LayoutChangeEvent) {
    width.value = e.nativeEvent.layout.width;
  }

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + DOCK_MARGIN }}
      className="px-6"
    >
      <Glass className="px-2 py-2" intensity={18}>
        <View onLayout={onLayout} className="flex-row items-center">
          <Animated.View
            pointerEvents="none"
            style={[highlightStyle, { position: 'absolute', width: HIGHLIGHT_WIDTH, height: HIGHLIGHT_HEIGHT, top: 4 }]}
            className="rounded-xl bg-glassTint border border-glassBorder"
          />
          {state.routes.map((route, i) => {
            const meta = META[route.name];
            if (!meta) return null;
            const Icon = meta.icon;
            const focused = state.index === i;
            const color = focused ? colors.accent : colors.muted;

            function onPress() {
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
              <Pressable
                key={route.key}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                className="flex-1 items-center justify-center py-2 gap-1"
              >
                <Icon color={color} size={20} />
                <Text
                  style={{ color }}
                  className={`text-[11px] ${focused ? 'font-semibold' : 'font-medium'}`}
                >
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Glass>
    </View>
  );
}
