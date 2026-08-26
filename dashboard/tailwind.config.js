/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        canvas: '#fbfaf7',
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#f5f3ec',
          muted: '#ede9df',
        },
        border: {
          subtle: '#e8e4db',
          strong: '#d3cebe',
        },
        forest: {
          50: '#f2f6f3',
          100: '#e1ede4',
          200: '#c5dccb',
          300: '#9ec1a7',
          400: '#719e7e',
          500: '#4d805c',
          600: '#3a6647',
          700: '#2d5038',
          800: '#234232', // Primary Brand Forest Green
          900: '#1b3326',
        },
        sage: {
          50: '#f6f8f6',
          100: '#e9efe9',
          200: '#d5e1d5',
          300: '#b8ccb8',
          400: '#94b095',
          500: '#739575',
          600: '#59775b',
          700: '#465d47',
          800: '#384a39',
        },
        sand: {
          50: '#fdfcfb',
          100: '#faf8f4',
          200: '#f2ece2',
          300: '#e7ddce',
          400: '#d5c6b0',
          500: '#beaa91',
          600: '#9d876d',
          700: '#7e6c55',
          800: '#5f5241',
          900: '#40382d',
        },
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(28, 25, 23, 0.04)',
        'card': '0 1px 3px 0 rgba(28, 25, 23, 0.05), 0 1px 2px -1px rgba(28, 25, 23, 0.05)',
        'elevated': '0 4px 12px 0 rgba(28, 25, 23, 0.06), 0 2px 4px -2px rgba(28, 25, 23, 0.04)',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out forwards',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
