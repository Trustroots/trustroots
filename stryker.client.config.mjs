// Mutation testing for the client Jest suite. See docs/testing/mutation-testing.md.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const jestConfig = require('./jest.config.cjs');

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'jest',
  plugins: ['@stryker-mutator/jest-runner'],
  jest: {
    configFile: 'jest.config.cjs',
    enableFindRelatedTests: true,
  },
  // Mutate exactly what the client coverage report measures.
  mutate: jestConfig.collectCoverageFrom.map(glob =>
    glob.replace('<rootDir>/', ''),
  ),
  coverageAnalysis: 'perTest',
  // Record every test that kills a mutant, not just the first, so the kill
  // matrix shows which tests are redundant.
  disableBail: true,
  // A static mutant (module-level code) has to run the whole suite. Skip them
  // to keep a run within hours; they are reported as "ignored".
  ignoreStatic: true,
  concurrency: 2,
  timeoutMS: 10000,
  incremental: true,
  incrementalFile: 'reports/stryker/client-incremental.json',
  tempDirName: '.stryker-tmp/client',
  reporters: ['clear-text', 'json', 'html', 'dots'],
  jsonReporter: { fileName: 'reports/stryker/client.json' },
  htmlReporter: { fileName: 'reports/stryker/client.html' },
  clearTextReporter: { reportTests: false, reportMutants: false },
  thresholds: { high: 80, low: 60, break: null },
};
