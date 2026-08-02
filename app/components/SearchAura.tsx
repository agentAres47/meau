import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  useDerivedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import Svg, { Defs, RadialGradient, Stop, Path } from 'react-native-svg';
import { colors } from '../theme/tokens';
import { useReducedMotion } from '../lib/reducedMotion';

// The searching visualisation for the passenger home: a scan of the map area
// around the (camera-centred) pickup, not a widget. It is deliberately built
// as several INDEPENDENT loops rather than one timeline:
//
//   ripples   2600 / 3100 / 3700 ms   (three, mutually out of phase)
//   scan      8000 ms                 (sweep · rest · sweep · longer rest)
//   breath    4300 ms                 (always-on idle, reverses)
//
// Because none of those periods divide into each other, the composite never
// lands in the same arrangement twice inside any plausible wait (the pattern
// only truly repeats after ~14 minutes). That is what buys "alive but not
// repetitive" without a JS-driven state machine: everything below runs on the
// UI thread, so it physically cannot stall while the JS thread is busy doing
// the actual search — the interface can never look frozen.
//
// Nothing here is time-boxed. `active` going false starts a decay; the loops
// keep running underneath it so the motion is never cut mid-stroke.

// One revolution of the scan, shaped so the beam sweeps, rests, sweeps a
// second time, then rests longer. Expressed as an easing over a single linear
// 0→1 clock (rather than a withSequence) so every cycle ends at exactly 360° —
// 360° and 0° are the same angle, so the loop seam is invisible.
function scanAngle(t: number): number {
  'worklet';
  const io = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  if (t < 0.19) return 0.5 * io(t / 0.19); // sweep to 180°
  if (t < 0.42) return 0.5; // rest
  if (t < 0.6) return 0.5 + 0.5 * io((t - 0.42) / 0.18); // sweep to 360°
  return 1; // longer rest
}

// The beam only exists while it is moving — it fades out into each rest. This
// is what keeps it from reading as a spinner: most of the loop, there is no
// rotating thing on screen at all.
function scanOpacity(t: number): number {
  'worklet';
  const seg = (a: number, b: number) => {
    if (t <= a || t >= b) return 0;
    return Math.min(1, Math.min(t - a, b - t) / 0.045);
  };
  return Math.max(seg(0, 0.19), seg(0.42, 0.6));
}

// A ripple leaves the centre, expands past the screen edge and dies. Staggered
// starts + prime-ish durations keep them from ever pulsing in unison.
const RIPPLES = [
  { duration: 2600, delay: 0 },
  { duration: 3100, delay: 900 },
  { duration: 3700, delay: 1900 },
] as const;

// Beam, drawn head-first: three wedges of decreasing opacity make a trail, so
// the sweep has a direction you can read instead of being a plain sector.
const WEDGES = [
  { from: 0, to: 26, opacity: 0.05 },
  { from: 26, to: 52, opacity: 0.11 },
  { from: 52, to: 80, opacity: 0.2 },
] as const;

function sectorPath(r: number, from: number, to: number) {
  const at = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(r + r * Math.cos(a)).toFixed(1)},${(r + r * Math.sin(a)).toFixed(1)}`;
  };
  return `M${r},${r} L${at(from)} A${r},${r} 0 0 1 ${at(to)} Z`;
}

type Props = {
  // False starts the decay. Keep the component mounted through the fade — the
  // point is that the animation is never stopped, only overtaken.
  active: boolean;
  centerX: number;
  centerY: number;
};

export function SearchAura({ active, centerX, centerY }: Props) {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  // Overscans the viewport on purpose: ripples should leave the screen rather
  // than terminate inside it, so the search reads as covering the area.
  const span = width * 1.35;
  const r = span / 2;

  const master = useSharedValue(0);
  const clock = useSharedValue(0);
  const breath = useSharedValue(0);
  const r0 = useSharedValue(0);
  const r1 = useSharedValue(0);
  const r2 = useSharedValue(0);
  const ripples = [r0, r1, r2];

  useEffect(() => {
    if (reduced) {
      // Static, legible equivalent: one held ring and a steady glow.
      clock.value = 0;
      breath.value = 0.5;
      ripples.forEach((v) => (v.value = 0.55));
      return;
    }
    clock.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1, false);
    breath.value = withRepeat(withTiming(1, { duration: 4300, easing: Easing.inOut(Easing.quad) }), -1, true);
    ripples.forEach((v, i) => {
      v.value = withDelay(
        RIPPLES[i].delay,
        withRepeat(withTiming(1, { duration: RIPPLES[i].duration, easing: Easing.out(Easing.quad) }), -1, false)
      );
    });
    // Shared values are stable refs; loops are started once per reduced-motion change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  // Arrive slower than we leave — appearing should feel like the screen
  // settling into a new state, leaving should feel like it giving way to the
  // answer.
  useEffect(() => {
    master.value = withTiming(active ? 1 : 0, {
      duration: active ? 700 : 480,
      easing: active ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad),
    });
  }, [active, master]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: master.value }));

  const scanStyle = useAnimatedStyle(() => ({
    opacity: scanOpacity(clock.value),
    transform: [{ rotate: `${scanAngle(clock.value) * 360}deg` }],
  }));

  // The one thing that is always moving, however slowly: the idle beat that
  // sits under the rests so the screen never fully stills.
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + 0.45 * breath.value,
    transform: [{ scale: 0.94 + 0.1 * breath.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: centerX - r,
          top: centerY - r,
          width: span,
          height: span,
          alignItems: 'center',
          justifyContent: 'center',
        },
        rootStyle,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}>
        <Svg width={span} height={span}>
          <Defs>
            <RadialGradient id="aura-glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.accent} stopOpacity={0.16} />
              <Stop offset="0.45" stopColor={colors.accent} stopOpacity={0.06} />
              <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Path d={sectorPath(r, 0, 359.99)} fill="url(#aura-glow)" />
        </Svg>
      </Animated.View>

      {ripples.map((p, i) => (
        <Ripple key={i} progress={p} span={span} />
      ))}

      {reduced ? null : (
        <Animated.View style={[StyleSheet.absoluteFill, scanStyle]}>
          <Svg width={span} height={span}>
            <Defs>
              <RadialGradient id="aura-beam" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={colors.accent} stopOpacity={0.9} />
                <Stop offset="0.55" stopColor={colors.accent} stopOpacity={0.5} />
                <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            {WEDGES.map((w) => (
              <Path
                key={w.from}
                d={sectorPath(r, w.from, w.to)}
                fill="url(#aura-beam)"
                fillOpacity={w.opacity}
              />
            ))}
          </Svg>
        </Animated.View>
      )}
    </Animated.View>
  );
}

function Ripple({ progress, span }: { progress: SharedValue<number>; span: number }) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      transform: [{ scale: 0.16 + p * 0.84 }],
      // Fades in fast, then spends the rest of its life dying — a ring that
      // faded symmetrically would read as a pulse, not as something leaving.
      opacity: p < 0.12 ? p / 0.12 * 0.45 : 0.45 * (1 - (p - 0.12) / 0.88),
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: span,
          height: span,
          borderRadius: span / 2,
          borderWidth: 1.5,
          borderColor: colors.accent,
        },
        style,
      ]}
    />
  );
}

// The same idle beat as the aura's glow, at sheet scale — used beside the
// "Finding your ride" line so the status text and the map visualisation are
// visibly the same event rather than two unrelated animations.
export function PulseDot({ size = 34 }: { size?: number }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = reduced
      ? 0.5
      : withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }), -1, false);
  }, [p, reduced]);

  const ring = useDerivedValue(() => (reduced ? 0.5 : p.value));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.4 + ring.value * 0.6 }],
    opacity: 0.5 * (1 - ring.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accent },
          ringStyle,
        ]}
      />
      <View
        style={{
          width: size * 0.3,
          height: size * 0.3,
          borderRadius: size,
          backgroundColor: colors.accent,
        }}
      />
    </View>
  );
}
