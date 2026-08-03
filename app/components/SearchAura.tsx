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
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { colors } from '../theme/tokens';
import { useReducedMotion } from '../lib/reducedMotion';

// The searching visualisation for the passenger home: a scan of the map area
// around the (camera-centred) pickup, not a widget.
//
// There is deliberately NO rotating beam. A sweeping wedge reads as radar —
// technical, and it pulls the eye to itself rather than to the status text
// that actually tells you what is happening. What is left is the calm idiom
// instead: something leaving the pickup point, outward, over and over.
//
//   ripples   3400 / 4100 / 4900 ms   (three, mutually out of phase)
//   breath    5200 ms                 (always-on idle, reverses)
//   wobble    9700 ms                 (slow drift in how strongly the other
//                                      two express themselves)
//
// None of those periods divide into each other, and `wobble` continuously
// varies the amplitude of the other two, so the composite never lands in the
// same arrangement twice inside any plausible wait. That is what buys "alive
// but not mechanical" without a JS-driven state machine: everything below runs
// on the UI thread, so it physically cannot stall while the JS thread is busy
// doing the actual search — the interface can never look frozen.
//
// Nothing here is time-boxed. `active` going false starts a decay; the loops
// keep running underneath it so the motion is never cut mid-stroke.

// A ripple leaves the centre, expands past the screen edge and dies. Staggered
// starts + prime-ish durations keep them from ever pulsing in unison. Slower
// than a heartbeat on purpose — this should read as steady, not urgent.
const RIPPLES = [
  { duration: 3400, delay: 0 },
  { duration: 4100, delay: 1150 },
  { duration: 4900, delay: 2400 },
] as const;

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
  const breath = useSharedValue(0);
  // The organic imperfection. Every amplitude below is multiplied by this, so
  // no two breaths are quite the same depth and no two ripples quite the same
  // strength — the difference between "alive" and "a loop".
  const wobble = useSharedValue(0.5);
  const r0 = useSharedValue(0);
  const r1 = useSharedValue(0);
  const r2 = useSharedValue(0);
  const ripples = [r0, r1, r2];

  useEffect(() => {
    if (reduced) {
      // Static, legible equivalent: one held ring and a steady glow.
      breath.value = 0.5;
      wobble.value = 0.5;
      ripples.forEach((v) => (v.value = 0.55));
      return;
    }
    breath.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.quad) }), -1, true);
    wobble.value = withRepeat(withTiming(1, { duration: 9700, easing: Easing.inOut(Easing.quad) }), -1, true);
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

  // The one thing that is always moving, however slowly: the idle beat under
  // everything else, so the screen never fully stills. `wobble` varies how
  // deep each breath goes, so it never settles into a metronome.
  const glowStyle = useAnimatedStyle(() => {
    const amp = 0.78 + 0.22 * wobble.value;
    return {
      opacity: 0.58 + 0.34 * breath.value * amp,
      transform: [{ scale: 0.95 + 0.07 * breath.value * amp }],
    };
  });

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
          <Circle cx={r} cy={r} r={r} fill="url(#aura-glow)" />
        </Svg>
      </Animated.View>

      {ripples.map((p, i) => (
        <Ripple key={i} progress={p} span={span} wobble={wobble} index={i} />
      ))}
    </Animated.View>
  );
}

function Ripple({
  progress,
  span,
  wobble,
  index,
}: {
  progress: SharedValue<number>;
  span: number;
  wobble: SharedValue<number>;
  index: number;
}) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    // Alternate which direction each ring reads the wobble, so neighbouring
    // rings are never at the same strength at the same time.
    const w = index % 2 === 0 ? wobble.value : 1 - wobble.value;
    const peak = 0.36 + 0.12 * w;
    return {
      transform: [{ scale: 0.16 + p * 0.84 }],
      // Fades in fast, then spends the rest of its life dying — a ring that
      // faded symmetrically would read as a pulse, not as something leaving.
      opacity: p < 0.12 ? (p / 0.12) * peak : peak * (1 - (p - 0.12) / 0.88),
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
