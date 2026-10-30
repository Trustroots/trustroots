import type { PlaywrightTestConfig } from '@playwright/test';
const path: typeof import('node:path') = require('node:path');
const {
  selectProjects,
}: typeof import('./scripts/e2e/groups.mts') = require('./scripts/e2e/groups.mts');
const {
  defineConfig,
  devices,
}: typeof import('@playwright/test') = require('@playwright/test');
const {
  generateSecretKey,
  nip19,
}: typeof import('nostr-tools') = require('nostr-tools');

const apiPort = process.env.TRUSTROOTS_E2E_API_PORT || 4301;
const applicationHost = process.env.TRUSTROOTS_E2E_HOST || 'localhost';
const applicationUrlHost = applicationHost.includes(':')
  ? `[${applicationHost}]`
  : applicationHost;
// The e2e script pins this host to IPv4 loopback so Node and Chromium cannot
// choose different localhost address families inside a container.
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL || `http://${applicationUrlHost}:${apiPort}`;
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
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

function serializedDependencies(
  defaultDependencies: string[],
  serializedDependencies: string[],
) {
  return serializeProjects ? serializedDependencies : defaultDependencies;
}

// A throwaway export-signing key per run, so the e2e export is actually signed
// and verified. Set on process.env so test workers see the same key.
process.env.TRUSTROOTS_EXPORT_SIGNING_NSEC ||=
  nip19.nsecEncode(generateSecretKey());

const webServers = [
  {
    command: 'pnpm run start:e2e:api',
    env: {
      TRUSTROOTS_TEST_STATS_OUTAGE: 'true',
      TRUSTROOTS_EXPORT_SIGNING_NSEC:
        process.env.TRUSTROOTS_EXPORT_SIGNING_NSEC,
    },
    url: `http://${applicationUrlHost}:${apiPort}/api/languages?format=array`,
    timeout: 120 * 1000,
    reuseExistingServer:
      process.env.TRUSTROOTS_E2E_REUSE_SERVER === 'true' && !process.env.CI,
  },
];

const config: PlaywrightTestConfig = defineConfig({
  testDir: './tests/e2e',
  testIgnore: ['**/support/**'],
  globalSetup: path.join(__dirname, 'tests/e2e/setup/global-setup.mts'),
  globalTeardown: path.join(__dirname, 'tests/e2e/setup/global-teardown.mts'),
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
      testMatch: /setup\/auth\.setup\.mts/,
      timeout: 120 * 1000,
    },
    {
      name: 'auth-smoke',
      testMatch: /features\/auth-account\/.*\.spec\.ts/,
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
      testMatch:
        /features\/profile-onboarding\/(?:authenticated|profile-react)\.spec\.ts/,
      dependencies: serializedDependencies(['setup-authenticated'], ['public']),
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
      name: 'photo-upload-firefox',
      testMatch: /features\/profile-onboarding\/authenticated\.spec\.ts/,
      grep: /member can upload a valid profile photo/,
      dependencies: serializedDependencies(
        ['setup-authenticated'],
        ['authenticated'],
      ),
      fullyParallel: false,
      use: {
        ...devices['Desktop Firefox'],
      },
    },
    {
      name: 'public',
      testMatch: /features\/public-core\/.*\.spec\.ts/,
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
      testMatch:
        /features\/messages\/(?:messages(?:-api)?|reply-statistics|greeter-recognition)\.spec\.ts/,
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
      testMatch: /features\/messages\/message-actions\.spec\.ts/,
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
      testMatch: /features\/relationships-safety\/.*\.spec\.ts/,
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
        /features\/search-offers-circles\/offers-and-circles\.spec\.ts/,
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
        /features\/search-offers-circles\/search-map-rendered\.spec\.ts/,
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
      // Firefox CI has no usable Mapbox GL/WebGL canvas, so cover wheel zoom via
      // the Leaflet raster path. Chromium search-map-rendered covers Mapbox.
      name: 'search-map-wheel-firefox',
      testMatch:
        /features\/search-offers-circles\/search-map-rendered\.spec\.ts/,
      grep: /raster fallback map/,
      dependencies: serializedDependencies(
        ['setup-authenticated'],
        ['search-map-rendered'],
      ),
      fullyParallel: false,
      use: {
        ...devices['Desktop Firefox'],
        storageState: seededMemberStorageState,
      },
    },
    {
      name: 'messages-firefox-layout',
      testMatch: /features\/messages\/messages-layout\.spec\.ts/,
      dependencies: serializedDependencies(['setup-authenticated'], ['admin']),
      fullyParallel: false,
      use: {
        ...devices['Desktop Firefox'],
        storageState: seededMemberStorageState,
      },
    },
    {
      name: 'experiences',
      testMatch: /features\/experiences-references\/.*\.spec\.ts/,
      dependencies: serializedDependencies(
        ['setup-authenticated'],
        ['setup-authenticated'],
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
      testMatch: /features\/profile-onboarding\/member\.spec\.ts/,
      dependencies: serializedDependencies(
        ['setup-authenticated'],
        ['setup-authenticated'],
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
      testMatch: /features\/admin-moderation\/.*\.spec\.ts/,
      dependencies: serializedDependencies(
        ['setup-authenticated'],
        ['setup-authenticated'],
      ),
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

config.projects = selectProjects(
  config.projects!,
  process.env.TRUSTROOTS_E2E_GROUP,
  serializeProjects,
);

module.exports = config;
