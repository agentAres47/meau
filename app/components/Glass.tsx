import { Platform, View, StyleSheet, type ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors } from '../theme/tokens';

type Props = ViewProps & {
  // Force the faux (no-blur) path on both platforms. Use for glass layered over
  // the live MapView — a BlurView over a moving map tanks FPS on Android and
  // isn't worth it on iOS either.
  overMap?: boolean;
  // iOS blur strength.
  intensity?: number;
  className?: string;
};

// Adaptive glassmorphism surface. iOS → real expo-blur BlurView with an accent
// tint; Android (and any overMap usage) → translucent accent fill + hairline
// border + soft shadow, same visual language, no blur cost. Layout (padding,
// gap, flex) comes from `className`; the glass shell (radius/border/fill/shadow)
// is style-driven so it stays consistent everywhere.
export function Glass({ overMap = false, intensity = 24, style, className, children, ...rest }: Props) {
  const useBlur = Platform.OS === 'ios' && !overMap;

  return (
    <View className={className} style={[styles.shell, !useBlur && styles.faux, style]} {...rest}>
      {useBlur ? (
        <>
          <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.tint]} pointerEvents="none" />
        </>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 24,
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
  // Android / overMap: translucent accent fill stands in for the blur.
  faux: {
    backgroundColor: colors.glassTint,
  },
  // iOS: thin accent wash over the BlurView so glass reads as branded, not grey.
  tint: {
    backgroundColor: colors.glassTint,
  },
});
