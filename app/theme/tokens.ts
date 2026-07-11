// Mirrors tailwind.config.js `theme.extend.colors` — keep both in sync.
// Accent = soft electric indigo: calm + trustworthy, reads as premium without
// tipping into acid-green/terracotta AI-default territory (see 11-UI-DESIGN.md).
export const colors = {
  bg: '#0E1116',
  surface: '#161B22',
  surface2: '#1F2630',
  text: '#EDF1F5',
  muted: '#8A94A3',
  accent: '#6C7BFF',
  accentSoft: '#6C7BFF33',
  success: '#3DDC84',
  danger: '#FF5C5C',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16 } as const;

export const fontSize = { xs: 12, sm: 14, base: 16, lg: 20, xl: 28, xxl: 34 } as const;
