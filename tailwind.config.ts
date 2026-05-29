import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#F5F0D0',
        'bg-soft': '#FAF6E3',
        accent: '#E8E0A0',
        ink: '#2C2A1E',
        'ink-2': '#6B6650',
        card: '#FFFFFF',
        border: '#D8D0A8',
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '16px',
        xl: '12px',
      },
      boxShadow: {
        card: '0 1px 4px 0 rgba(44,42,30,0.07)',
      },
    },
  },
  plugins: [],
}

export default config
