import { type ReactNode } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { motion } from '../theme/tokens';
import { useReducedMotion } from '../lib/reducedMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  className?: string;
  // Scale at full press. Defaults to the standard 0.97 press-in.
  scale?: number;
  children?: ReactNode;
};

// Reusable press micro-interaction: a smooth 150ms scale-in on touch (the
// project-standard button/card feel), honoring reduced-motion. Low-level
// primitive — higher components (Button, tappable cards) compose it and expose
// their own className for styling.
export function PressableScale({ className, scale = motion.pressScale, style, disabled, children, ...rest }: Props) {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduced || disabled ? 1 : 1 - pressed.value * (1 - scale) }],
  }));

  return (
    <AnimatedPressable
      className={className}
      disabled={disabled}
      style={[animatedStyle, style]}
      {...rest}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: motion.fast });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: motion.fast });
      }}
    >
      {children}
    </AnimatedPressable>
  );
}
