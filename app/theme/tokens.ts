// Design tokens — single source of truth. Color values here MUST stay in sync
// with tailwind.config.js `theme.extend.colors` (className usage like `bg-accent`
// reads from tailwind; direct RN styles read from here).
//
// Dark-only. Palette: warm near-black base with a soft plum gradient; accent is
// a premium powder pink used sparingly (~5–10% of any screen) for selection,
// focus and live states. Primary CTAs use the deeper `accentCta` pink.
export const colors = {
  bg: '#0D0D0D',
  surface: '#151218', // warm dark — first gradient step; non-glass raised fills
  surface2: '#23171E', // warmer raised — inputs, skeleton, second gradient step
  text: '#EDEDED',
  muted: '#9A9298',
  accent: '#F7A6C1', // selection, focus, active icons, live states
  accentCta: '#E87BA5', // deeper pink — primary buttons only
  accentSoft: '#F7A6C133', // ~20% — glows, active tab pill, radar
  success: '#3DDC84',
  danger: '#FF5C5C',
  // Glass surface fills (see components/Glass). Faux-glass on Android, tint over
  // BlurView on iOS.
  glassTint: '#F7A6C11A', // ~10% accent
  glassBorder: '#F7A6C126', // ~15% accent
} as const;

// Background gradient stops (expo-linear-gradient, top → bottom). Used by the
// shared Screen wrapper so every screen shares one warm plum-dark canvas.
export const gradient = ['#0D0D0D', '#151218', '#23171E'] as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

// Card radii bumped for the glass language (glass corners 20–28px).
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, pill: 999 } as const;

export const fontSize = { xs: 12, sm: 14, base: 16, lg: 20, xl: 28, xxl: 34 } as const;

// Motion — subtle, professional, 150–300ms. `spring` matches the existing tab-bar
// feel. `pressScale`/`pressLift` drive the shared Pressable micro-interaction.
// All motion is gated by useReducedMotion at the call site.
export const motion = {
  fast: 150,
  base: 220,
  slow: 300,
  spring: { damping: 18, stiffness: 180 },
  pressScale: 0.97,
} as const;
