/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    fontFamily: {
      sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular'],
      numerals: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
    },
    extend: {
      colors: {
        navy: {
          50: '#f0f4ff',
          100: '#e0e8ff',
          200: '#c7d4fe',
          300: '#a3b6fc',
          400: '#7a8ef8',
          500: '#5a66f2',
          600: '#4347e5',
          700: '#3638cb',
          800: '#2e31a4',
          900: '#1a1d4e',
          950: '#0f1129',
          1000: '#080912',
        },
        accent: {
          50: '#f0fdff',
          100: '#ccfbff',
          200: '#99f5ff',
          300: '#54e8fc',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
