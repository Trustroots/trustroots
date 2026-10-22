#!/usr/bin/env node

const { spawn } =
  require('node:child_process') as typeof import('node:child_process');
const os = require('node:os') as typeof import('node:os');
const path = require('node:path') as typeof import('node:path');

const root = path.resolve(__dirname, '..');
const vitest = path.join(
  path.dirname(require.resolve('vitest/package.json')),
  'vitest.mjs',
);

const child = spawn(
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
    // Own process group, so a signal reaches the forked test processes too.
    detached: true,
    env: { ...process.env, VITEST_MAX_WORKERS: '1' },
  },
);

// Exit only once Vitest and its forked tests have stopped, so a parent that
// cleans up databases after cancelling does not race orphaned tests.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(signal, () => {
    try {
      process.kill(-(child.pid as number), signal);
    } catch {
      // The group is already gone.
    }
  });
}

child.on('error', error => {
  console.error(error.message);
  process.exit(1);
});

child.on('close', (code, signal) => {
  process.exit(code ?? (signal ? 128 + os.constants.signals[signal] : 1));
});
