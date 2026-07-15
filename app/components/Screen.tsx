import { type ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Edge } from 'react-native-safe-area-context';
import { gradient, gradientLocations } from '../theme/tokens';

type Props = {
  children: ReactNode;
  // Safe-area edges to inset. Defaults to top only (tab screens); pass
  // ['top','bottom'] for full-height flows, or [] for full-bleed (e.g. map).
  edges?: readonly Edge[];
  className?: string;
};

// Shared screen canvas: near-flat black for most of the screen, with only a
// whisper of wine warmth in the last third (see gradientLocations) — every
// screen shares this one restrained backdrop for the glass layers to float
// over. Deliberately NOT a visible pink/plum wash.
export function Screen({ children, edges = ['top'], className }: Props) {
  return (
    <LinearGradient colors={gradient} locations={gradientLocations} style={{ flex: 1 }}>
      <SafeAreaView className={`flex-1 ${className ?? ''}`} edges={edges}>
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}
