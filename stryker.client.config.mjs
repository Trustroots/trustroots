// Mutation testing for the client Vitest suite. See docs/mutation-testing.md.
import vitestConfig from './vitest.client.config.mts';

const { coverage } = vitestConfig.test;

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  plugins: [
    '@stryker-mutator/vitest-runner',
    './tooling/stryker/ignore-export-names.mjs',
  ],
  ignorers: ['export-names'],
  vitest: {
    configFile: 'vitest.client.config.mts',
    related: true,
  },
  // Mutate exactly what the client coverage report measures.
  mutate: [...coverage.include, ...coverage.exclude.map(glob => `!${glob}`)],
  ignorePatterns: [
    '/.stryker-tmp',
    '/.prune-tmp',
    '/.stryker-work',
    '/reports',
    '/coverage',
  ],
  coverageAnalysis: 'perTest',
  // Stop at the first failing test. Each killed mutant records the test that
  // caught it first, so a test that is never a first killer has every kill
  // also made by another test.
  disableBail: false,
  // A static mutant (module-level code) has to run the whole suite. Skip them
  // to keep a run within hours; they are reported as "ignored".
  ignoreStatic: true,
  concurrency: 5,
  timeoutMS: 10000,
  dryRunTimeoutMinutes: 60,
  incremental: true,
  incrementalFile: 'reports/stryker/client-incremental.json',
  tempDirName: '.stryker-tmp/client',
  reporters: ['clear-text', 'json', 'html', 'dots'],
  jsonReporter: { fileName: 'reports/stryker/client.json' },
  htmlReporter: { fileName: 'reports/stryker/client.html' },
  clearTextReporter: { reportTests: false, reportMutants: false },
  thresholds: { high: 80, low: 60, break: null },
};
