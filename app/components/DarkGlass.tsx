import { View, StyleSheet, type ViewProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/tokens';

type Props = ViewProps & {
  radius?: number;
  className?: string;
};

// The floating-chrome surface for anything that sits permanently over the live
// map — tab bar, search/post card, driver header, recenter button.
//
// NO BlurView here, deliberately, and this is worth reading before "fixing" it:
// on Android a real backdrop blur CANNOT blur the map. Google Maps renders into
// a SurfaceView, which the system composites separately from the view
// hierarchy; expo-blur's dimezisBlurView works by drawing that hierarchy into a
// canvas, and SurfaceView content simply isn't in it. Verified empirically —
// at intensity 100 the map behind this surface stayed perfectly sharp. A
// BlurView here is pure cost for zero visual effect.
//
// So over the map, opacity is the only lever, and there is a genuine trade:
// low opacity lets sharp map detail (place labels, road casings) punch through
// as a "dirty window"; high opacity hides it but you stop seeing the map. This
// sits high enough to stay clean. iOS is not affected — blur works there — but
// this component is shared, so it stays consistent rather than diverging.
//
// Glass.tsx keeps its real blur: those surfaces sit over ordinary RN views,
// where dimezisBlurView does work.
const SHEEN_COLORS = ['#FFFFFF0D', '#FFFFFF00'] as const;
const SHEEN_LOCATIONS = [0, 0.28] as const;

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
          // Restrained: the border is what separates this from the map. A heavy
          // shadow reads as a card dropped ON the UI rather than glass sitting
          // in it, but over a live map some lift still helps legibility, so
          // this is reduced rather than removed.
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 5,
        },
        style,
      ]}
      {...rest}
    >
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.dockGlassTint }]}
        pointerEvents="none"
      />
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
