import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#090d16',
        foreground: '#f8fafc',
        card: {
          DEFAULT: '#0f172a',
          foreground: '#f8fafc',
        },
        primary: {
          DEFAULT: '#06b6d4',
          foreground: '#ffffff',
        },
        accent: {
          DEFAULT: '#ec4899',
          foreground: '#ffffff',
        }
      },
      fontFamily: {
        display: ['system-ui', '-apple-system', 'sans-serif'],
        mono: ['monospace'],
      }
    },
  },
  plugins: [],
}
export default config
