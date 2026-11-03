// Mutation testing for the Nostranslation Jest suite. See docs/testing/mutation-testing.md.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const jestConfig = require('./apps/nostranslation/jest.config.cjs');

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'jest',
  plugins: ['@stryker-mutator/jest-runner'],
  jest: {
    configFile: 'apps/nostranslation/jest.config.cjs',
    enableFindRelatedTests: true,
  },
  mutate: jestConfig.collectCoverageFrom.map(glob =>
    glob.replace('<rootDir>/', ''),
  ),
  coverageAnalysis: 'perTest',
  disableBail: true,
  ignoreStatic: true,
  concurrency: 2,
  timeoutMS: 10000,
  incremental: true,
  incrementalFile: 'reports/stryker/nostranslation-incremental.json',
  tempDirName: '.stryker-tmp/nostranslation',
  reporters: ['clear-text', 'json', 'html', 'dots'],
  jsonReporter: { fileName: 'reports/stryker/nostranslation.json' },
  htmlReporter: { fileName: 'reports/stryker/nostranslation.html' },
  clearTextReporter: { reportTests: false, reportMutants: false },
  thresholds: { high: 80, low: 60, break: null },
};
