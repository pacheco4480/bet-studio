import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
  test: {
    environment: 'jsdom',
    exclude: ['e2e/**', 'node_modules/**', 'dist/**', 'dist-api/**'],
    globals: true,
    setupFiles: './src/presentation/web/test/setup.ts',
    testTimeout: 15000,
  },
});
