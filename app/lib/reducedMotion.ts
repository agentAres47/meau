import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Only the continuous/looping animations (Radar pulse, Skeleton shimmer)
// check this — a tiny press-scale on a button isn't the kind of motion
// reduced-motion settings are meant to suppress.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}
