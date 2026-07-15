import { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import type { ViewProps } from 'react-native';
import { useReducedMotion } from '../lib/reducedMotion';
import { colors } from '../theme/tokens';

type Props = ViewProps & {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
};

export function Skeleton({ width = '100%', height = 16, radius = 8, style, ...rest }: Props) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = reduced ? 0.6 : withRepeat(withTiming(1, { duration: 700, easing: Easing.ease }), -1, true);
  }, [opacity, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.surface2 }, animatedStyle, style]}
      {...rest}
    />
  );
}
