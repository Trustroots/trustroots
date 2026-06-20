// @ts-check
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');

const apiPort = process.env.TRUSTROOTS_E2E_API_PORT || 4301;
const webPort = process.env.TRUSTROOTS_E2E_WEB_PORT || 4300;
const useWebpackDevServer =
  process.env.TRUSTROOTS_E2E_USE_WEBPACK_DEV_SERVER === 'true';
// Use `localhost` (not `127.0.0.1`) to match the host the app binds to
// (config.host) and the webpack dev-server proxy target. On machines where
// `localhost` resolves to IPv6 (::1), probing 127.0.0.1 never succeeds and the
// webServer readiness check times out.
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  (useWebpackDevServer
    ? `http://localhost:${webPort}`
    : `http://localhost:${apiPort}`);
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const authStorageState = path.join(__dirname, 'tests/e2e/.auth/member.json');
const seededMemberStorageState = path.join(
  __dirname,
  'tests/e2e/.auth/seeded-member.json',
);
const adminStorageState = path.join(__dirname, 'tests/e2e/.auth/admin.json');

const webServers = useWebpackDevServer
  ? [
      {
        command: 'npm run start:e2e:api',
        url: `http://localhost:${apiPort}/api/languages?format=array`,
        timeout: 120 * 1000,
        reuseExistingServer:
          process.env.TRUSTROOTS_E2E_REUSE_SERVER === 'true' && !process.env.CI,
      },
      {
        command: 'npm run start:e2e:web',
        url: baseURL,
        timeout: 180 * 1000,
        reuseExistingServer:
          process.env.TRUSTROOTS_E2E_REUSE_SERVER === 'true' && !process.env.CI,
      },
    ]
  : [
      {
        command: 'npm run start:e2e:api',
        url: `http://localhost:${apiPort}/api/languages?format=array`,
        timeout: 120 * 1000,
        reuseExistingServer:
          process.env.TRUSTROOTS_E2E_REUSE_SERVER === 'true' && !process.env.CI,
      },
    ];

module.exports = defineConfig({
  testDir: './tests/e2e',
  globalSetup: require.resolve('./tests/e2e/global-setup.js'),
  globalTeardown: require.resolve('./tests/e2e/global-teardown.js'),
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  // Run projects (and parallel-safe specs) concurrently. CI keeps a fixed,
  // conservative worker count for stability; locally we let Playwright scale to
  // half the available cores instead of running everything serially.
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'coverage/e2e/playwright-results.json' }],
  ],
  outputDir: 'test-results',
  use: {
    baseURL,
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup-authenticated',
      testMatch: /auth\.setup\.js/,
      timeout: 120 * 1000,
    },
    {
      name: 'auth-smoke',
      testMatch: /auth-smoke\.spec\.js/,
      fullyParallel: false,
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
    {
      name: 'authenticated',
      testMatch: /authenticated\.spec\.js/,
      dependencies: ['setup-authenticated'],
      fullyParallel: true,
      use: {
        ...devices['Desktop Chrome'],
        storageState: authStorageState,
        ...(chromiumExecutablePath
          ? {
              launchOptions: {
                executablePath: chromiumExecutablePath,
              },
            }
          : {}),
      },
    },
    {
      name: 'public',
      testMatch: /(public-pages|nostr|seeded-content)\.spec\.js/,
      fullyParallel: true,
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
    {
      name: 'messages',
      testMatch: /messages\.spec\.js/,
      dependencies: ['setup-authenticated'],
      fullyParallel: true,
      use: {
        ...devices['Desktop Chrome'],
        storageState: seededMemberStorageState,
        ...(chromiumExecutablePath
          ? {
              launchOptions: {
                executablePath: chromiumExecutablePath,
              },
            }
          : {}),
      },
    },
    {
      name: 'experiences',
      testMatch: /experiences\.spec\.js/,
      dependencies: ['setup-authenticated'],
      fullyParallel: true,
      use: {
        ...devices['Desktop Chrome'],
        storageState: seededMemberStorageState,
        ...(chromiumExecutablePath
          ? {
              launchOptions: {
                executablePath: chromiumExecutablePath,
              },
            }
          : {}),
      },
    },
    {
      name: 'member',
      testMatch: /member\.spec\.js/,
      dependencies: ['setup-authenticated'],
      fullyParallel: true,
      use: {
        ...devices['Desktop Chrome'],
        storageState: seededMemberStorageState,
        ...(chromiumExecutablePath
          ? {
              launchOptions: {
                executablePath: chromiumExecutablePath,
              },
            }
          : {}),
      },
    },
    {
      name: 'admin',
      testMatch: /admin\.spec\.js/,
      dependencies: ['setup-authenticated'],
      fullyParallel: false,
      use: {
        ...devices['Desktop Chrome'],
        storageState: adminStorageState,
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
  webServer: webServers,
});
