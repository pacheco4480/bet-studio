import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command:
      'npx concurrently -k -s first "npx tsx src/presentation/api/server.ts" "npx vite"',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    gracefulShutdown: { signal: 'SIGINT', timeout: 1000 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
