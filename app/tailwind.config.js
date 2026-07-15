/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Keep in sync with theme/tokens.ts `colors`.
      colors: {
        bg: '#0D0D0D',
        surface: '#121012',
        surface2: '#1A1517',
        text: '#EDEDED',
        muted: '#9A9298',
        accent: '#F7A6C1',
        accentCta: '#E87BA5',
        accentSoft: '#F7A6C133',
        success: '#3DDC84',
        danger: '#FF5C5C',
        glassTint: '#0D0D0DB3',
        glassBorder: '#FFFFFF26',
      },
      fontSize: {
        xs: '12px',
        sm: '14px',
        base: '16px',
        lg: '20px',
        xl: '28px',
        xxl: '34px',
      },
      // Additive (no collision with tailwind defaults). Glass corners 20–28px;
      // pill for primary buttons and chips.
      borderRadius: {
        glass: '24px',
        pill: '999px',
      },
    },
  },
  plugins: [],
};
