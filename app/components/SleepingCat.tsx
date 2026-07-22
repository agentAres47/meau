import { useEffect } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, motion } from '../theme/tokens';
import { useReducedMotion } from '../lib/reducedMotion';

// A "hint of cat" — NOT the full animated mascot (that's dropped). Purpose:
// reduce anxiety during waiting. Rules held:
//   - Subtle, static, one cat max.
//   - ONE gentle entrance (fade + settle), then still. No loops, no sequences.
//   - Only in loading / searching / empty states. Never during navigation or a
//     live ride. Never blocks UI. Muted + premium, never childish.
export function SleepingCat({ size = 76 }: { size?: number }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(0);

  useEffect(() => {
    v.value = reduced ? 1 : withSpring(1, motion.spring);
  }, [reduced, v]);

  const style = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ scale: 0.9 + v.value * 0.1 }],
  }));

  return (
    <Animated.View
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* curled body */}
        <Path
          d="M18 70 Q10 42 38 34 Q72 24 84 52 Q92 74 60 78 Q30 82 18 70 Z"
          fill={colors.muted}
          opacity={0.9}
        />
        {/* head resting on the body */}
        <Circle cx="34" cy="60" r="16" fill={colors.muted} opacity={0.9} />
        {/* ears */}
        <Path d="M22 49 L24 38 L33 46 Z" fill={colors.muted} opacity={0.9} />
        <Path d="M39 46 L46 37 L49 49 Z" fill={colors.muted} opacity={0.9} />
        {/* tail curling toward the front */}
        <Path
          d="M60 78 Q86 76 84 54"
          stroke={colors.muted}
          strokeWidth={8}
          strokeLinecap="round"
          fill="none"
          opacity={0.9}
        />
        {/* closed, content eye */}
        <Path
          d="M27 60 Q32 64 37 60"
          stroke={colors.bg}
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}
