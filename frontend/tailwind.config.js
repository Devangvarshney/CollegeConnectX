/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f7fa',
          100: '#e4e8f0',
          200: '#cdd5e1',
          300: '#aab8cc',
          400: '#7f96b2',
          500: '#5e7798',
          600: '#4a5e7b',
          700: '#3c4c64',
          800: '#344153',
          900: '#2e3746',
          950: '#1f242e',
        }
      }
    },
  },
  plugins: [],
}
