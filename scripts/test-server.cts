#!/usr/bin/env node

const { spawnSync } =
  require('node:child_process') as typeof import('node:child_process');
const path = require('node:path') as typeof import('node:path');

const root = path.resolve(__dirname, '..');
const vitest = path.join(
  path.dirname(require.resolve('vitest/package.json')),
  'vitest.mjs',
);

const result = spawnSync(
  process.execPath,
  [
    vitest,
    'run',
    '--config',
    path.join(root, 'vitest.server.config.mts'),
    ...(process.env.SERVER_TEST_COVERAGE ? ['--coverage'] : []),
    ...process.argv.slice(2),
  ],
  // An inherited VITEST_MAX_WORKERS would run files concurrently against one
  // database.
  {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, VITEST_MAX_WORKERS: '1' },
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
