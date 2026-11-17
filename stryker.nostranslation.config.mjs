// Mutation testing for the Nostranslation Vitest suite. See docs/mutation-testing.md.
import vitestConfig from './apps/nostranslation/vitest.config.mts';

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
    configFile: 'apps/nostranslation/vitest.config.mts',
    related: true,
  },
  mutate: [...coverage.include, ...coverage.exclude.map(glob => `!${glob}`)],
  ignorePatterns: [
    '/.stryker-tmp',
    '/.prune-tmp',
    '/.stryker-work',
    '/reports',
    '/coverage',
  ],
  coverageAnalysis: 'perTest',
  // See stryker.client.config.mjs for why bail stays on.
  disableBail: false,
  ignoreStatic: true,
  concurrency: 5,
  timeoutMS: 10000,
  dryRunTimeoutMinutes: 60,
  incremental: true,
  incrementalFile: 'reports/stryker/nostranslation-incremental.json',
  tempDirName: '.stryker-tmp/nostranslation',
  reporters: ['clear-text', 'json', 'html', 'dots'],
  jsonReporter: { fileName: 'reports/stryker/nostranslation.json' },
  htmlReporter: { fileName: 'reports/stryker/nostranslation.html' },
  clearTextReporter: { reportTests: false, reportMutants: false },
  thresholds: { high: 80, low: 60, break: null },
};
