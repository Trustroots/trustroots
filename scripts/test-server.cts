#!/usr/bin/env node

const { spawn } =
  require('node:child_process') as typeof import('node:child_process');
const os = require('node:os') as typeof import('node:os');
const { randomBytes } = require('node:crypto') as typeof import('node:crypto');
const { MongoClient } = require('mongodb') as typeof import('mongodb');
const path = require('node:path') as typeof import('node:path');

const root = path.resolve(__dirname, '..');
const vitest = path.join(
  path.dirname(require.resolve('vitest/package.json')),
  'vitest.mjs',
);

// The suite drops its database on start, so two runs sharing the default
// database wipe each other's data mid-test. Give each run its own.
const ownDatabase =
  process.env.NODE_ENV === 'test' &&
  !process.env.TRUSTROOTS_SERVER_TEST_DATABASE
    ? `trustroots-test-worker-${randomBytes(6).toString('hex')}-1`
    : undefined;

async function dropOwnDatabase(): Promise<void> {
  if (!ownDatabase) return;
  const host = process.env.DB_1_PORT_27017_TCP_ADDR || 'localhost';
  const client = new MongoClient(`mongodb://${host}`, {
    serverSelectionTimeoutMS: 5000,
  });
  try {
    await client.connect();
    await client.db(ownDatabase).dropDatabase();
  } catch {
    // The run never reached the database, or it is already gone.
  } finally {
    await client.close();
  }
}

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
    env: {
      ...process.env,
      VITEST_MAX_WORKERS: '1',
      ...(ownDatabase ? { TRUSTROOTS_SERVER_TEST_DATABASE: ownDatabase } : {}),
    },
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

child.on('close', async (code, signal) => {
  await dropOwnDatabase();
  process.exit(code ?? (signal ? 128 + os.constants.signals[signal] : 1));
});
