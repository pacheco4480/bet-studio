import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        studio: {
          ink: '#07090d',
          panel: '#10151f',
          lime: '#b8ff3d',
          violet: '#8f5cff',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
