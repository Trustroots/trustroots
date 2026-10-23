const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const {
  execFileSync,
}: typeof import('node:child_process') = require('node:child_process');
const fs: typeof import('node:fs') = require('node:fs');
const os: typeof import('node:os') = require('node:os');
const path: typeof import('node:path') = require('node:path');

describe('Native server coverage', () => {
  it(
    'counts native TypeScript and mocked module execution against their original sources',
    { timeout: 30000 },
    () => {
      const root = path.resolve(__dirname, '../../../../..');
      const directory = fs.mkdtempSync(
        path.join(os.tmpdir(), 'server-coverage-'),
      );
      const sources = [
        'modules/users/server/services/user-roles.server.service.mts',
        'modules/admin/server/controllers/admin.circles.server.controller.mts',
      ];
      try {
        // These existing suites exercise typed function parameters and many
        // separately mocked copies of a module. Both used to lose V8 counts.
        execFileSync(
          process.execPath,
          [
            path.join(
              path.dirname(require.resolve('vitest/package.json')),
              'vitest.mjs',
            ),
            'run',
            '--config',
            path.join(root, 'vitest.server.config.mts'),
            '--coverage',
            ...sources.map(source => `--coverage.include=${source}`),
            `--coverage.reportsDirectory=${directory}`,
            '--coverage.reporter=json-summary',
          ],
          {
            cwd: root,
            env: {
              ...process.env,
              NODE_OPTIONS: '',
              SERVER_TEST_SKIP_DATABASE: 'true',
              SERVER_TEST_FILES: [
                'modules/users/tests/server/services/user-roles.server.service.tests.cts',
                'modules/admin/tests/server/admin.circles.server.controller.unit.tests.cts',
              ].join(','),
              SERVER_TEST_BLOB_OUTPUT: '',
              SERVER_TEST_TIMINGS_OUTPUT: '',
            },
            stdio: 'pipe',
            timeout: 25000,
          },
        );
        const summary = JSON.parse(
          fs.readFileSync(
            path.join(directory, 'coverage-summary.json'),
            'utf8',
          ),
        ) as Record<string, Record<string, { total: number; pct: number }>>;
        for (const source of sources) {
          const coverage = summary[path.join(root, source)];
          assert(coverage, `Missing coverage for ${source}`);
          assert(
            coverage.functions.total > 0,
            `No functions counted in ${source}`,
          );
          for (const metric of [
            'statements',
            'branches',
            'functions',
            'lines',
          ]) {
            assert.equal(coverage[metric].pct, 100, `${source}: ${metric}`);
          }
        }
      } finally {
        fs.rmSync(directory, { recursive: true, force: true });
      }
    },
  );
});
