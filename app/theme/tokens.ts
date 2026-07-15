// Design tokens — single source of truth. Color values here MUST stay in sync
// with tailwind.config.js `theme.extend.colors` (className usage like `bg-accent`
// reads from tailwind; direct RN styles read from here).
//
// Dark-only. Palette: the app should read as premium BLACK first — near-flat,
// almost no visible gradient, with only a whisper of wine warmth near the very
// bottom of the screen (see `gradient`). Glass surfaces are intentionally
// colorless (low-opacity white + hairline white border) so the background is
// what supplies any color, never the glass itself. Accent (powder pink) is
// reserved for active/selected states, primary CTAs, and small highlights —
// never a default/always-on fill. See colors.ts usage audit before adding a
// new always-on `bg-accent`.
export const colors = {
  bg: '#0D0D0D',
  surface: '#121012', // barely lifted off bg — non-glass raised fills (e.g. ScreenHeader)
  surface2: '#1A1517', // raised — inputs, skeleton, unselected chips
  text: '#EDEDED',
  muted: '#9A9298',
  accent: '#F7A6C1', // selection, focus, active icons, live states — sparing use only
  accentCta: '#E87BA5', // deeper pink — primary buttons only
  accentSoft: '#F7A6C133', // ~20% — glows for legitimate active states (radar, tab pill)
  success: '#3DDC84',
  danger: '#FF5C5C',
  // Glass surface fills (see components/Glass). Colorless (bg-tinted, not
  // pink) but genuinely DARK/opaque — this sits over live map content, and a
  // too-faint fill lets the map dominate and fights the legibility of
  // whatever's on the glass. Android has no real blur in its faux path, so
  // this opacity IS the Android equivalent of "blur amount." A thin white
  // hairline border still defines the edge. Target mix across any screen:
  // ~95% black, ~4% glass, ~1% accent — achieved by glass covering a small
  // fraction of the screen, not by the glass itself being faint.
  glassTint: '#0D0D0DB3', // bg-black at ~70% — darkens/obscures what's behind it
  glassBorder: '#FFFFFF26', // ~15% white — thin hairline, not a visible box edge
} as const;

// Background gradient stops + stop positions (expo-linear-gradient, top →
// bottom). Near-flat black for most of the screen — the transition should
// barely be noticeable, never a visible "pink screen."
export const gradient = ['#090909', '#0D0D0D', '#141113'] as const;
export const gradientLocations = [0, 0.7, 1] as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

// Card radii bumped for the glass language (glass corners 20–28px).
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, pill: 999 } as const;

export const fontSize = { xs: 12, sm: 14, base: 16, lg: 20, xl: 28, xxl: 34 } as const;

// Motion — subtle, professional, 150–300ms. `spring` is tuned to be
// critically/slightly-over damped (no overshoot) for premium, Apple/Arc-like
// settle: for stiffness 220 + mass 1, critical damping ≈ 29.7, so damping 30
// stops precisely with no bounce. `pressScale`/`pressLift` drive the shared
// Pressable micro-interaction. All motion is gated by useReducedMotion at the
// call site.
export const motion = {
  fast: 150,
  base: 220,
  slow: 300,
  spring: { damping: 30, stiffness: 220, mass: 1 },
  pressScale: 0.97,
} as const;
