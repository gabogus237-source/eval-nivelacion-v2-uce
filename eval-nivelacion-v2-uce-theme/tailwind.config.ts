import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        uce: {
          green: '#0B6B3A',
          dark: '#084D2A',
          light: '#E6F3EC',
          gold: '#B08F26'
        }
      },
      borderRadius: { '2xl':'1rem' }
    }
  },
  plugins: [],
}
export default config
