// Mutation testing for the server Vitest suite. See docs/mutation-testing.md.
import serverScope from './scripts/mutation/server-scope.cts';

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  plugins: [
    '@stryker-mutator/vitest-runner',
    './tooling/stryker/ignore-export-names.mjs',
  ],
  ignorers: ['export-names'],
  vitest: {
    configFile: 'vitest.stryker.server.config.mts',
    pool: 'forks',
    // Server tests reach code over HTTP and the job queue, not just imports.
    related: false,
  },
  // Mutate exactly what the server coverage report measures; the list and
  // its exclusions live with the CI scope planner so they can't drift.
  mutate: serverScope.mutatePatterns,
  // Ansible vault files are not JavaScript, whatever their extension.
  ignorePatterns: [
    '/deploy/files/secrets',
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
  timeoutMS: 5000,
  dryRunTimeoutMinutes: 60,
  incremental: true,
  incrementalFile: 'reports/stryker/server-incremental.json',
  tempDirName: '.stryker-tmp/server',
  reporters: ['clear-text', 'json', 'html', 'dots'],
  jsonReporter: { fileName: 'reports/stryker/server.json' },
  htmlReporter: { fileName: 'reports/stryker/server.html' },
  clearTextReporter: { reportTests: false, reportMutants: false },
  thresholds: { high: 80, low: 60, break: null },
};
