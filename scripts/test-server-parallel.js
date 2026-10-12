#!/usr/bin/env node
/* eslint-disable no-console */
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { statSync } = require('node:fs');
const path = require('node:path');
const glob = require('glob');
const { MongoClient } = require('mongodb');

const root = path.resolve(__dirname, '..');

function createPlan(
  files,
  workerCount = '2',
  token = randomBytes(6).toString('hex'),
) {
  if (!/^[1-8]$/.test(String(workerCount))) {
    throw new Error('SERVER_TEST_WORKERS must be an integer between 1 and 8.');
  }
  if (!/^[a-f0-9]{12}$/.test(token)) {
    throw new Error('Invalid server-test invocation token.');
  }
  const relativeFiles = files.map(file => {
    const relative = path.relative(root, path.resolve(root, file));
    if (!/^modules\/[^/]+\/tests\/server\/.+\.js$/.test(relative)) {
      throw new Error(`Not a server test file: ${file}`);
    }
    return relative;
  });
  const uniqueFiles = [...new Set(relativeFiles)].map(file => ({
    file,
    size: statSync(path.join(root, file)).size,
  }));
  if (!uniqueFiles.length) throw new Error('No server test files selected.');
  const workers = Array.from(
    { length: Math.min(Number(workerCount), uniqueFiles.length) },
    (_, index) => ({
      database: `trustroots-test-worker-${token}-${index + 1}`,
      files: [],
      size: 0,
    }),
  );
  // File size is a cheap initial estimate; largest files go to the lightest worker.
  uniqueFiles.sort((a, b) => b.size - a.size || a.file.localeCompare(b.file));
  for (const entry of uniqueFiles) {
    const worker = workers.reduce((lightest, candidate) =>
      candidate.size < lightest.size ? candidate : lightest,
    );
    worker.files.push(entry.file);
    worker.size += entry.size;
  }
  return workers;
}

async function cleanupDatabases(plan, env) {
  const host = env.DB_1_PORT_27017_TCP_ADDR || 'localhost';
  const client = new MongoClient(`mongodb://${host}`, {
    serverSelectionTimeoutMS: 5000,
  });
  try {
    await client.connect();
    for (const worker of plan) await client.db(worker.database).dropDatabase();
  } finally {
    await client.close();
  }
}

async function runWorkers(
  plan,
  {
    env = process.env,
    spawnProcess = spawn,
    cleanup = cleanupDatabases,
    signals = process,
    log = console.log,
  } = {},
) {
  const children = [];
  let interrupted;
  const stop = signal => {
    interrupted = signal;
    for (const child of children) child.kill(signal);
  };
  const onInterrupt = () => stop('SIGINT');
  const onTerminate = () => stop('SIGTERM');
  signals.once('SIGINT', onInterrupt);
  signals.once('SIGTERM', onTerminate);
  try {
    const results = await Promise.all(
      plan.map(
        (worker, index) =>
          new Promise(resolve => {
            log(
              `Server worker ${index + 1}: ${
                worker.files.length
              } files, database ${worker.database}`,
            );
            try {
              const child = spawnProcess(
                process.execPath,
                [path.join(root, 'scripts/test-server.js')],
                {
                  cwd: root,
                  stdio: 'inherit',
                  env: {
                    ...env,
                    NODE_ENV: 'test',
                    TRUSTROOTS_SKIP_LOCAL_CONFIG: 'true',
                    TRUSTROOTS_SERVER_TEST_DATABASE: worker.database,
                    SERVER_TEST_FILES: worker.files.join(','),
                  },
                },
              );
              children.push(child);
              child.once('error', error => {
                log(
                  `Server worker ${index + 1} could not start: ${
                    error.message
                  }`,
                );
                resolve(1);
              });
              child.once('exit', (code, signal) => {
                log(`Server worker ${index + 1} finished: ${signal || code}`);
                resolve(code === 0 && !signal ? 0 : 1);
              });
            } catch (error) {
              log(
                `Server worker ${index + 1} could not start: ${error.message}`,
              );
              resolve(1);
            }
          }),
      ),
    );
    return interrupted
      ? interrupted === 'SIGINT'
        ? 130
        : 143
      : results.some(Boolean)
      ? 1
      : 0;
  } finally {
    signals.removeListener('SIGINT', onInterrupt);
    signals.removeListener('SIGTERM', onTerminate);
    await cleanup(plan, env);
  }
}

async function main() {
  const files = process.argv.slice(2);
  const selected = files.length
    ? files
    : process.env.SERVER_TEST_FILES
    ? process.env.SERVER_TEST_FILES.split(',').filter(Boolean)
    : glob.sync('modules/*/tests/server/**/*.js', { cwd: root });
  const plan = createPlan(selected, process.env.SERVER_TEST_WORKERS ?? '2');
  process.exitCode = await runWorkers(plan);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { createPlan, runWorkers, cleanupDatabases };
