import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Marker, type LatLng } from 'react-native-maps';
import Svg, { Circle as SvgCircle, Polygon } from 'react-native-svg';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, motion } from '../theme/tokens';
import { useReducedMotion } from '../lib/reducedMotion';

// react-native-maps snapshots a custom marker's children to a native bitmap
// for performance (tracksViewChanges=false is the correct default — constant
// re-snapshotting is the classic Android map-jank cause). But a fresh marker's
// entrance animation needs a few live frames to actually render before we
// freeze it. This hook tracks briefly on (re)mount, then locks to false.
function useTracksViewChangesBriefly(key: string, durationMs = 400): boolean {
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    setTracking(true);
    const t = setTimeout(() => setTracking(false), durationMs);
    return () => clearTimeout(t);
  }, [key, durationMs]);
  return tracking;
}

// "You are here" — a soft breathing glow behind a small filled dot. Pulses in
// place only; never moves along a route (no live tracking, see REDESIGN_PLAN).
export function CurrentLocationMarker({ coordinate }: { coordinate: LatLng }) {
  const reduced = useReducedMotion();
  const tracksViewChanges = useTracksViewChangesBriefly(`${coordinate.latitude},${coordinate.longitude}`);
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = reduced
      ? 0.5
      : withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
  }, [pulse, reduced]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.5 + pulse.value }],
    opacity: 1 - pulse.value,
  }));

  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={tracksViewChanges}>
      <Animated.View entering={FadeIn.duration(motion.base)} className="w-8 h-8 items-center justify-center">
        <Animated.View
          style={ringStyle}
          className="absolute w-8 h-8 rounded-full"
          pointerEvents="none"
        >
          <View className="w-full h-full rounded-full bg-accentSoft" />
        </Animated.View>
        <View
          className="w-3.5 h-3.5 rounded-full bg-accent"
          style={{ borderWidth: 2, borderColor: colors.bg }}
        />
      </Animated.View>
    </Marker>
  );
}

// Pickup — a small elegant ring with a subtle glow (matches PlaceRow's accent
// "Circle" affordance used in the picker/search form).
export function PickupMarker({ coordinate }: { coordinate: LatLng }) {
  const tracksViewChanges = useTracksViewChangesBriefly(`${coordinate.latitude},${coordinate.longitude}`);
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={tracksViewChanges}>
      <Animated.View
        entering={FadeIn.duration(motion.base)}
        className="w-9 h-9 rounded-full bg-accentSoft items-center justify-center"
      >
        <View
          className="w-4 h-4 rounded-full bg-accent"
          style={{ borderWidth: 2, borderColor: colors.bg }}
        />
      </Animated.View>
    </Marker>
  );
}

// Destination — a minimal rounded pin (not the default Google red teardrop).
// Drawn as a single SVG (circle head + triangular tail) rather than
// rotated/stacked Views: react-native-maps computes a custom marker's anchor
// from its unrotated layout box, so a CSS-rotated shape risks the visual tip
// not lining up with the actual coordinate. An SVG's own bottom edge is the
// tip, so anchor={{ y: 1 }} lines up exactly regardless of the shape drawn.
export function DestinationMarker({ coordinate }: { coordinate: LatLng }) {
  const tracksViewChanges = useTracksViewChangesBriefly(`${coordinate.latitude},${coordinate.longitude}`);
  return (
    <Marker coordinate={coordinate} anchor={{ x: 0.5, y: 1 }} tracksViewChanges={tracksViewChanges}>
      <Animated.View entering={FadeIn.duration(motion.base)}>
        <Svg width={28} height={36} viewBox="0 0 28 36">
          <Polygon points="14,36 6,20 22,20" fill={colors.success} />
          <SvgCircle cx={14} cy={13} r={12} fill={colors.success} stroke={colors.bg} strokeWidth={2} />
          <SvgCircle cx={14} cy={13} r={4} fill={colors.bg} />
        </Svg>
      </Animated.View>
    </Marker>
  );
}
