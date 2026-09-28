// @ts-check
const path = require('path');
const { defineConfig, devices } = require('@playwright/test');
const base = require('./playwright.config');

if (!process.env.BRAVE_EXECUTABLE_PATH) {
  throw new Error(
    'BRAVE_EXECUTABLE_PATH is required for the Windows wheel job.',
  );
}

const wheelSpec =
  /features\/search-offers-circles\/search-map-rendered\.spec\.js/;
const memberState = path.join(__dirname, 'tests/e2e/.auth/seeded-member.json');
const chromiumOptions = {
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
};

module.exports = defineConfig({
  ...base,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    [
      'html',
      { outputFolder: 'playwright-report/windows-wheel', open: 'never' },
    ],
    ['json', { outputFile: 'test-results/windows-wheel-results.json' }],
  ],
  use: {
    ...base.use,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'node server.js',
    url: `${base.use.baseURL}/api/languages?format=array`,
    timeout: 120000,
    env: { PORT: process.env.TRUSTROOTS_E2E_API_PORT || '4301' },
  },
  projects: [
    {
      name: 'setup-windows-wheel',
      testMatch: /setup\/auth\.setup\.js/,
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'windows-edge-wheel',
      testMatch: wheelSpec,
      grep: /mouse wheel/,
      dependencies: ['setup-windows-wheel'],
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
        storageState: memberState,
        launchOptions: chromiumOptions,
      },
    },
    {
      name: 'windows-brave-wheel',
      testMatch: wheelSpec,
      grep: /mouse wheel/,
      dependencies: ['setup-windows-wheel'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: memberState,
        launchOptions: {
          ...chromiumOptions,
          executablePath: process.env.BRAVE_EXECUTABLE_PATH,
        },
      },
    },
    {
      name: 'windows-firefox-wheel',
      testMatch: wheelSpec,
      grep: /mouse wheel.*raster fallback map/,
      dependencies: ['setup-windows-wheel'],
      use: { ...devices['Desktop Firefox'], storageState: memberState },
    },
  ],
});
