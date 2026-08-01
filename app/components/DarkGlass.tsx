import { Platform, View, StyleSheet, type ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/tokens';

type Props = ViewProps & {
  radius?: number;
  intensity?: number;
  className?: string;
};

// The floating-chrome surface for anything that sits permanently over the live
// map — tab bar, search/post card, driver header, recenter button. Distinct
// from Glass.tsx (used for Cards etc.): Glass's Android faux-fill (glassTint,
// ~70% opaque) let raw map detail bleed through unevenly when placed on chrome
// that's ALWAYS over the map (read as a smudgy "gradient"), so this uses a
// darker/more-opaque translucent fill (dockGlassTint, ~90%) instead. It still
// carries Glass's same reflective top-sheen highlight + hairline edge, so it
// reads as glass rather than a flat opaque panel — a fully opaque fill (no
// sheen) was the earlier, over-corrected version that felt like "no glass at
// all." See BRAND_SYSTEM.md §6.
const SHEEN_COLORS = ['#FFFFFF14', '#FFFFFF00'] as const;

export function DarkGlass({ radius = 24, intensity = 50, style, className, children, ...rest }: Props) {
  return (
    <View
      className={className}
      style={[
        {
          overflow: 'hidden',
          borderRadius: radius,
          borderWidth: 1,
          borderColor: colors.glassBorder,
          shadowColor: '#000',
          shadowOpacity: 0.4,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 12,
        },
        style,
      ]}
      {...rest}
    >
      {/* The blur is the point: an opaque fill can only DARKEN the map, so the
          brightest map detail (place labels, road casings) still punched
          through as sharp smudges — the "dirty window" look. Blurring smears
          that into a uniform wash, which is what makes the surface read as
          clean glass rather than a translucent panel with junk behind it. */}
      <BlurView
        intensity={intensity}
        tint="dark"
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.dockGlassTint }]}
        pointerEvents="none"
      />
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
