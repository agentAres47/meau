import { View, StyleSheet, type ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/tokens';

type Props = ViewProps & {
  radius?: number;
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

export function DarkGlass({ radius = 24, style, className, children, ...rest }: Props) {
  return (
    <View
      className={className}
      style={[
        {
          overflow: 'hidden',
          borderRadius: radius,
          borderWidth: 1,
          borderColor: colors.glassBorder,
          backgroundColor: colors.dockGlassTint,
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
