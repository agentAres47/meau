import { Platform, View, StyleSheet, type ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/tokens';

type Props = ViewProps & {
  // Force the faux (no-blur) path on both platforms. Use for glass layered over
  // the live MapView — a BlurView over a moving map tanks FPS on Android and
  // isn't worth it on iOS either.
  overMap?: boolean;
  // iOS blur strength.
  intensity?: number;
  // Corner radius override — most surfaces use the shared 24px glass radius,
  // but a shorter element (e.g. the floating dock) can pass a value closer to
  // its own height for a true pill look.
  radius?: number;
  className?: string;
};

// A hairline-thin top sheen — the cheap, blur-free stand-in for "premium
// reflections": a barely-there white-to-transparent wash across the top third
// of the surface. Costs nothing (one small gradient), works identically on
// both platforms regardless of which fill path (blur vs faux) is active.
const SHEEN_COLORS = ['#FFFFFF14', '#FFFFFF00'] as const;

// Adaptive glassmorphism surface. iOS → real expo-blur BlurView with a
// near-colorless tint; Android (and any overMap usage) → translucent white
// fill + hairline border + soft shadow, same visual language, no blur cost.
// Layout (padding, gap, flex) comes from `className`; the glass shell
// (radius/border/fill/shadow) is style-driven so it stays consistent
// everywhere.
export function Glass({ overMap = false, intensity = 24, radius = 24, style, className, children, ...rest }: Props) {
  const useBlur = Platform.OS === 'ios' && !overMap;

  return (
    <View className={className} style={[styles.shell, { borderRadius: radius }, !useBlur && styles.faux, style]} {...rest}>
      {useBlur ? (
        <>
          <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.tint]} pointerEvents="none" />
        </>
      ) : null}
      <LinearGradient
        colors={SHEEN_COLORS}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        locations={[0, 0.5]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
    // Soft float — subtle on dark, no harsh drop shadow.
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  // Android / overMap: translucent white fill stands in for the blur.
  faux: {
    backgroundColor: colors.glassTint,
  },
  // iOS: thin wash over the BlurView so glass reads as premium frosted glass,
  // not plain grey blur.
  tint: {
    backgroundColor: colors.glassTint,
  },
});
