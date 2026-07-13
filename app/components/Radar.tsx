import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Search, type LucideIcon } from 'lucide-react-native';
import { colors } from '../theme/tokens';

export function Radar({ icon: Icon = Search }: { icon?: LucideIcon }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
  }, [p]);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: 0.6 + p.value }], opacity: 1 - p.value }));

  return (
    <View className="w-32 h-32 items-center justify-center">
      <Animated.View style={ring} className="absolute w-32 h-32 rounded-full bg-accentSoft" />
      <View className="w-16 h-16 rounded-full bg-accentSoft items-center justify-center">
        <Icon color={colors.accent} size={26} />
      </View>
    </View>
  );
}
