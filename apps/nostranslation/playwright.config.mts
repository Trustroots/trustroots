import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4311/nostranslation/',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm nostranslation:dev',
    url: 'http://127.0.0.1:4311/nostranslation/',
    env: { VITE_NOSTRANSLATION_API_URL: 'https://translation-api.example' },
    reuseExistingServer: false,
  },
});
