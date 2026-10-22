#!/usr/bin/env node

const { spawn, spawnSync } =
  require('node:child_process') as typeof import('node:child_process');
const { randomBytes } = require('node:crypto') as typeof import('node:crypto');
const { globSync, rmSync, statSync } =
  require('node:fs') as typeof import('node:fs');
const path = require('node:path') as typeof import('node:path');
const { MongoClient } = require('mongodb') as typeof import('mongodb');
const { readTimings } = require('./server-test-timings.cts');

const root = path.resolve(__dirname, '..');

type Worker = { database: string; files: string[]; size: number };
type FileWeight = { file: string; size: number };
type WorkerChild = Pick<
  import('node:child_process').ChildProcess,
  'kill' | 'once'
>;
type SignalSource = Pick<NodeJS.Process, 'once' | 'removeListener'>;
interface RunWorkerOptions {
  env?: NodeJS.ProcessEnv;
  spawnProcess?: typeof spawn;
  cleanup?: typeof cleanupDatabases;
  signals?: SignalSource;
  log?: (message: string) => void;
}

function createPlan(
  files: string[],
  workerCount: string | number = '2',
  token: string = randomBytes(6).toString('hex'),
  durations: Record<string, number> = {},
): Worker[] {
  if (!/^[1-8]$/.test(String(workerCount))) {
    throw new Error('SERVER_TEST_WORKERS must be an integer between 1 and 8.');
  }
  if (!/^[a-f0-9]{12}$/.test(token)) {
    throw new Error('Invalid server-test invocation token.');
  }
  const relativeFiles = files.map(file => {
    const relative = path.relative(root, path.resolve(root, file));
    if (!/^modules\/[^/]+\/tests\/server\/.+\.(?:js|cts|mts)$/.test(relative)) {
      throw new Error(`Not a server test file: ${file}`);
    }
    return relative;
  });
  const uniqueFiles: FileWeight[] = [...new Set(relativeFiles)].map(file => ({
    file,
    size: statSync(path.join(root, file)).size,
  }));
  if (!uniqueFiles.length) throw new Error('No server test files selected.');
  const workers: Worker[] = Array.from(
    { length: Math.min(Number(workerCount), uniqueFiles.length) },
    (_, index) => ({
      database: `trustroots-test-worker-${token}-${index + 1}`,
      files: [],
      size: 0,
    }),
  );
  // Estimate unknown files on the same scale as measured milliseconds.
  const measured = uniqueFiles.filter(
    entry =>
      durations[entry.file] > 0 && Number.isFinite(durations[entry.file]),
  );
  const millisecondsPerByte = measured.length
    ? measured.reduce((sum, entry) => sum + durations[entry.file], 0) /
      Math.max(
        1,
        measured.reduce((sum, entry) => sum + entry.size, 0),
      )
    : 1;
  for (const entry of uniqueFiles) {
    entry.size = measured.includes(entry)
      ? durations[entry.file]
      : Math.max(1, entry.size * millisecondsPerByte);
  }
  // Longest files go to the lightest worker, independent of input ordering.
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

async function cleanupDatabases(
  plan: Worker[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
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
  plan: Worker[],
  {
    env = process.env,
    spawnProcess = spawn,
    cleanup = cleanupDatabases,
    signals = process,
    log = console.log,
  }: RunWorkerOptions = {},
): Promise<number> {
  const children: WorkerChild[] = [];
  let interrupted: NodeJS.Signals | undefined;
  const stop = (signal: NodeJS.Signals): void => {
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
          new Promise<number>(resolve => {
            log(
              `Server worker ${index + 1}: ${
                worker.files.length
              } files, database ${worker.database}`,
            );
            try {
              const child = spawnProcess(
                process.execPath,
                [path.join(root, 'scripts/test-server.cts')],
                {
                  cwd: root,
                  stdio: 'inherit',
                  env: {
                    ...env,
                    NODE_ENV: 'test',
                    TRUSTROOTS_SKIP_LOCAL_CONFIG: 'true',
                    TRUSTROOTS_SERVER_TEST_DATABASE: worker.database,
                    SERVER_TEST_FILES: worker.files.join(','),
                    ...(env.SERVER_TEST_BLOB_DIR
                      ? {
                          SERVER_TEST_BLOB_OUTPUT: path.join(
                            env.SERVER_TEST_BLOB_DIR,
                            `worker-${index + 1}.json`,
                          ),
                        }
                      : {}),
                    ...(env.SERVER_TEST_COVERAGE_DIR
                      ? {
                          SERVER_TEST_COVERAGE_OUTPUT: path.join(
                            env.SERVER_TEST_COVERAGE_DIR,
                            `worker-${index + 1}`,
                          ),
                        }
                      : {}),
                    ...(env.SERVER_TEST_TIMINGS_DIR
                      ? {
                          SERVER_TEST_TIMINGS_OUTPUT: path.join(
                            env.SERVER_TEST_TIMINGS_DIR,
                            `worker-${index + 1}.json`,
                          ),
                        }
                      : {}),
                  },
                },
              );
              children.push(child);
              child.once('error', (error: Error) => {
                log(
                  `Server worker ${index + 1} could not start: ${error.message}`,
                );
                resolve(1);
              });
              child.once(
                'exit',
                (code: number | null, signal: NodeJS.Signals | null) => {
                  log(`Server worker ${index + 1} finished: ${signal || code}`);
                  resolve(code === 0 && !signal ? 0 : 1);
                },
              );
            } catch (error) {
              const message =
                error instanceof Error ? error.message : String(error);
              log(`Server worker ${index + 1} could not start: ${message}`);
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

async function main(): Promise<void> {
  const files: string[] = process.argv.slice(2);
  const selected = files.length
    ? files
    : process.env.SERVER_TEST_FILES
      ? process.env.SERVER_TEST_FILES.split(',').filter(Boolean)
      : globSync('modules/*/tests/server/**/*.{js,cts,mts}', {
          cwd: root,
        }).sort();
  const durations = process.env.SERVER_TEST_TIMINGS_DIR
    ? readTimings(process.env.SERVER_TEST_TIMINGS_DIR)
    : {};
  const plan = createPlan(
    selected,
    process.env.SERVER_TEST_WORKERS ?? '2',
    undefined,
    durations,
  );
  if (!process.env.SERVER_TEST_COVERAGE) {
    process.exitCode = await runWorkers(plan);
    return;
  }
  const blobDirectory = path.join(root, 'coverage/server-blobs');
  const workerCoverageDirectory = path.join(root, 'coverage/server-workers');
  rmSync(blobDirectory, { recursive: true, force: true });
  rmSync(workerCoverageDirectory, { recursive: true, force: true });
  const exitCode = await runWorkers(plan, {
    env: {
      ...process.env,
      SERVER_TEST_BLOB_DIR: blobDirectory,
      SERVER_TEST_COVERAGE_DIR: workerCoverageDirectory,
    },
  });
  if (exitCode !== 0) {
    process.exitCode = exitCode;
    return;
  }
  const merged = spawnSync(
    process.execPath,
    [
      path.join(
        path.dirname(require.resolve('vitest/package.json')),
        'vitest.mjs',
      ),
      'run',
      '--config',
      path.join(root, 'vitest.server.config.mts'),
      '--merge-reports',
      blobDirectory,
      '--coverage',
    ],
    { cwd: root, stdio: 'inherit' },
  );
  process.exitCode = merged.status ?? 1;
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

module.exports = { createPlan, runWorkers, cleanupDatabases };
