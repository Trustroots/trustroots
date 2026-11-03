// Mutation testing for the Nostranslation Jest suite. See docs/testing/mutation-testing.md.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const jestConfig = require('./apps/nostranslation/jest.config.cjs');

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'jest',
  plugins: ['@stryker-mutator/jest-runner', './tooling/stryker/ignore-export-names.mjs'],
  ignorers: ['export-names'],
  jest: {
    configFile: 'apps/nostranslation/jest.config.cjs',
    enableFindRelatedTests: true,
  },
  mutate: jestConfig.collectCoverageFrom.map(glob =>
    glob.replace('<rootDir>/', ''),
  ),
  // Ansible vault files are not JavaScript, whatever their extension.
  ignorePatterns: ['/deploy/files/secrets', '/.stryker-tmp', '/.prune-tmp', '/.stryker-work', '/reports', '/coverage'],
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
