/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Keep in sync with theme/tokens.ts
      colors: {
        bg: '#0E1116',
        surface: '#161B22',
        surface2: '#1F2630',
        text: '#EDF1F5',
        muted: '#8A94A3',
        accent: '#6C7BFF',
        accentSoft: '#6C7BFF33',
        success: '#3DDC84',
        danger: '#FF5C5C',
      },
      fontSize: {
        xs: '12px',
        sm: '14px',
        base: '16px',
        lg: '20px',
        xl: '28px',
        xxl: '34px',
      },
    },
  },
  plugins: [],
};
