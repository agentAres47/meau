import { type ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Edge } from 'react-native-safe-area-context';
import { gradient } from '../theme/tokens';

type Props = {
  children: ReactNode;
  // Safe-area edges to inset. Defaults to top only (tab screens); pass
  // ['top','bottom'] for full-height flows, or [] for full-bleed (e.g. map).
  edges?: readonly Edge[];
  className?: string;
};

// Shared screen canvas: the warm plum-dark background gradient every screen sits
// on. Replaces the old flat `bg-bg` SafeAreaView so the whole app shares one
// continuous backdrop for the glass layers to float over.
export function Screen({ children, edges = ['top'], className }: Props) {
  return (
    <LinearGradient colors={gradient} style={{ flex: 1 }}>
      <SafeAreaView className={`flex-1 ${className ?? ''}`} edges={edges}>
        {children}
      </SafeAreaView>
    </LinearGradient>
  );
}
