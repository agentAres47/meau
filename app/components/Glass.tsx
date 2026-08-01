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
const SHEEN_COLORS = ['#FFFFFF0D', '#FFFFFF00'] as const;
const SHEEN_LOCATIONS = [0, 0.28] as const;

// Adaptive glassmorphism surface. iOS → real expo-blur BlurView with a
// near-colorless dark tint; Android (and any overMap usage) → translucent
// dark fill + hairline border + soft shadow, same visual language, no blur
// cost. Layout (padding, gap, flex) comes from `className`; the glass shell
// (radius/border/fill/shadow) is style-driven so it stays consistent
// everywhere.
export function Glass({ overMap = false, intensity = 60, radius = 24, style, className, children, ...rest }: Props) {
  // Real blur on BOTH platforms now, except over the map. Android previously
  // fell back to the faux fill unconditionally, so every glass surface there
  // was a flat translucent panel — the whole reason the app read as "not
  // glassy" on Android while reference apps (which do blur Android too) didn't.
  // expo-blur can do a genuine backdrop blur on Android via dimezisBlurView.
  // `overMap` still opts out: that blur samples the view behind it every frame,
  // which is exactly the cost we can't pay over a continuously-moving map.
  const useBlur = !overMap;

  return (
    <View className={className} style={[styles.shell, { borderRadius: radius }, !useBlur && styles.faux, style]} {...rest}>
      {useBlur ? (
        <>
          <BlurView
            intensity={intensity}
            tint="dark"
            experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, styles.tint]} pointerEvents="none" />
        </>
      ) : null}
      <LinearGradient
        colors={SHEEN_COLORS}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        locations={SHEEN_LOCATIONS}
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
    // Soft float — subtle on dark, no harsh drop shadow. Kept light so the
    // hairline border stays the thing defining the edge.
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  // Android / overMap: translucent dark fill stands in for the blur — this
  // is what actually darkens/obscures the map (or whatever's behind), since
  // Android has no real blur in this path.
  faux: {
    backgroundColor: colors.glassTint,
  },
  // Thin wash over the BlurView so glass reads as premium frosted glass, not
  // plain grey blur. Deliberately lighter than the faux fill — see
  // glassTintBlur in tokens.
  tint: {
    backgroundColor: colors.glassTintBlur,
  },
});
