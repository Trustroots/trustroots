// Mutation testing for the server Vitest suite. See docs/testing/mutation-testing.md.

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  vitest: {
    configFile: 'vitest.stryker.server.config.mts',
    pool: 'forks',
    // Server tests reach code over HTTP and the job queue, not just imports.
    related: false,
  },
  // Mutate exactly what the server coverage report measures.
  mutate: [
    'modules/*/server/**/*.{mjs,mts}',
    'packages/analytics/server/**/*.mts',
    'packages/logger/**/*.mts',
    '!modules/*/tests/**',
    '!**/node_modules/**',
    '!modules/*/server/**/*.model.{mjs,mts}',
    '!modules/*/server/models/**',
    '!modules/core/server/jobs/send-push-message.server.job.mjs',
    '!modules/users/server/jobs/user-welcome-sequence-*.server.job.{mjs,mts}',
  ],
  coverageAnalysis: 'perTest',
  disableBail: true,
  ignoreStatic: true,
  concurrency: 2,
  timeoutMS: 20000,
  incremental: true,
  incrementalFile: 'reports/stryker/server-incremental.json',
  tempDirName: '.stryker-tmp/server',
  reporters: ['clear-text', 'json', 'html', 'dots'],
  jsonReporter: { fileName: 'reports/stryker/server.json' },
  htmlReporter: { fileName: 'reports/stryker/server.html' },
  clearTextReporter: { reportTests: false, reportMutants: false },
  thresholds: { high: 80, low: 60, break: null },
};
