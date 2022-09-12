/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    fontFamily: {
      sans: ['Urbanist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      mono: ['ui-monospace', 'SFMono-Regular'],
      numerals: ['Open Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
    },
    extend: {},
  },
  plugins: [require('@tailwindcss/forms')],
};
