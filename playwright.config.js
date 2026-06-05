// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const webPort = process.env.TRUSTROOTS_E2E_WEB_PORT || 4300;
const apiPort = process.env.TRUSTROOTS_E2E_API_PORT || 4301;
// Use `localhost` (not `127.0.0.1`) to match the host the app binds to
// (config.host) and the webpack dev-server proxy target. On machines where
// `localhost` resolves to IPv6 (::1), probing 127.0.0.1 never succeeds and the
// webServer readiness check times out.
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${webPort}`;
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  outputDir: 'test-results',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(chromiumExecutablePath
          ? {
              launchOptions: {
                executablePath: chromiumExecutablePath,
              },
            }
          : {}),
      },
    },
  ],
  webServer: [
    {
      command: 'npm run start:e2e:api',
      url: `http://localhost:${apiPort}/api/languages?format=array`,
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run start:e2e:web',
      url: baseURL,
      timeout: 180 * 1000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
