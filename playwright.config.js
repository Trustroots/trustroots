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
const configuredWorkers = Number.parseInt(
  process.env.TRUSTROOTS_E2E_WORKERS || '1',
  10,
);
const workers =
  Number.isFinite(configuredWorkers) && configuredWorkers > 0
    ? configuredWorkers
    : 1;
const hasProjectFilter = process.argv.some(
  arg => arg === '--project' || arg.startsWith('--project='),
);
const serializeProjects =
  process.env.TRUSTROOTS_E2E_SERIAL_PROJECTS === undefined
    ? workers > 1 && !hasProjectFilter
    : process.env.TRUSTROOTS_E2E_SERIAL_PROJECTS === 'true';

function serializedDependencies(defaultDependencies, serializedDependencies) {
  return serializeProjects ? serializedDependencies : defaultDependencies;
}

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
  globalSetup: require.resolve('./tests/e2e/setup/global-setup.js'),
  globalTeardown: require.resolve('./tests/e2e/setup/global-teardown.js'),
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  // Keep local runs conservative by default while allowing CI to opt into
  // limited file-level parallelism once specs isolate mutating state.
  workers,
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
    video: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup-authenticated',
      testMatch: /setup\/auth\.setup\.js/,
      timeout: 120 * 1000,
    },
    {
      name: 'auth-smoke',
      testMatch: /features\/auth-account\/.*\.spec\.js/,
      dependencies: serializedDependencies([], ['setup-authenticated']),
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
      testMatch: /features\/profile-onboarding\/authenticated\.spec\.js/,
      dependencies: serializedDependencies(['setup-authenticated'], ['public']),
      fullyParallel: false,
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
      testMatch: /features\/public-core\/.*\.spec\.js/,
      dependencies: serializedDependencies([], ['auth-smoke']),
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
      name: 'messages',
      testMatch: /features\/messages\/messages\.spec\.js/,
      dependencies: serializedDependencies(
        ['setup-authenticated'],
        ['authenticated'],
      ),
      fullyParallel: false,
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
      name: 'message-actions',
      testMatch: /features\/messages\/message-actions\.spec\.js/,
      dependencies: serializedDependencies(
        ['setup-authenticated'],
        ['messages'],
      ),
      fullyParallel: false,
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
      name: 'relationships-safety',
      testMatch: /features\/relationships-safety\/.*\.spec\.js/,
      dependencies: serializedDependencies(
        ['setup-authenticated'],
        ['message-actions'],
      ),
      fullyParallel: false,
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
      name: 'search-offers-circles',
      testMatch:
        /features\/search-offers-circles\/offers-and-circles\.spec\.js/,
      dependencies: serializedDependencies(
        ['setup-authenticated'],
        ['relationships-safety'],
      ),
      fullyParallel: false,
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
      name: 'search-map-rendered',
      testMatch:
        /features\/search-offers-circles\/search-map-rendered\.spec\.js/,
      dependencies: serializedDependencies(
        ['setup-authenticated'],
        ['search-offers-circles'],
      ),
      fullyParallel: false,
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
      testMatch: /features\/experiences-references\/.*\.spec\.js/,
      dependencies: serializedDependencies(
        ['setup-authenticated'],
        ['search-map-rendered'],
      ),
      fullyParallel: false,
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
      testMatch: /features\/profile-onboarding\/member\.spec\.js/,
      dependencies: serializedDependencies(
        ['setup-authenticated'],
        ['experiences'],
      ),
      fullyParallel: false,
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
      testMatch: /features\/admin-moderation\/.*\.spec\.js/,
      dependencies: serializedDependencies(['setup-authenticated'], ['member']),
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
