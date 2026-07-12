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
import { colors } from '../theme/tokens';

const META: Record<string, { icon: LucideIcon; label: string }> = {
  driver: { icon: Car, label: 'Driver' },
  passenger: { icon: Search, label: 'Passenger' },
  autopool: { icon: Users, label: 'Auto Pool' },
};

const INSET = 10; // horizontal padding of the sliding pill within a tab slot

// Custom bottom tab bar with a spring-animated active pill (11-UI-DESIGN.md).
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const count = state.routes.length;
  const width = useSharedValue(0);
  const index = useSharedValue(state.index);

  useEffect(() => {
    index.value = withSpring(state.index, { damping: 18, stiffness: 180 });
  }, [state.index, index]);

  const pillStyle = useAnimatedStyle(() => {
    const slot = width.value / count;
    return {
      width: slot - INSET * 2,
      transform: [{ translateX: index.value * slot + INSET }],
    };
  });

  function onLayout(e: LayoutChangeEvent) {
    width.value = e.nativeEvent.layout.width;
  }

  return (
    <View
      onLayout={onLayout}
      style={{ paddingBottom: insets.bottom }}
      className="flex-row bg-surface border-t border-surface2"
    >
      <Animated.View
        pointerEvents="none"
        style={pillStyle}
        className="absolute top-2 bottom-2 rounded-2xl bg-accentSoft"
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
            className="flex-1 items-center justify-center py-3 gap-1 active:scale-95"
          >
            <Icon color={color} size={22} />
            <Text
              style={{ color }}
              className={`text-xs ${focused ? 'font-semibold' : 'font-medium'}`}
            >
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
