import { createRequire } from 'node:module';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  it,
} from 'vitest';
import type { Connection } from 'mongoose';

const require = createRequire(import.meta.url);

interface MongooseService {
  connect(callback: (connection: Connection) => void): void;
  dropDatabase(connection: Connection, callback: (error?: Error) => void): void;
  loadModels(callback: () => void): Promise<void>;
  ensureIndexes(modelNames: string[]): Promise<void>;
}

type Callback = (error?: unknown) => void;
type MochaStyleFunction = (this: unknown, done: Callback) => unknown;
type Wrapped = (...args: unknown[]) => unknown;

// The suite was written for Mocha. A callback-style test or hook declares a
// `done` parameter, which Vitest does not support.
function promisify(fn: MochaStyleFunction | undefined) {
  if (typeof fn !== 'function' || fn.length === 0) return fn;
  return () =>
    new Promise<void>((resolve, reject) => {
      fn.call({}, error => (error ? reject(error) : resolve()));
    });
}

function wrapRegister<T extends Wrapped>(register: T): T {
  return ((name: unknown, fn?: MochaStyleFunction, ...rest: unknown[]) =>
    register(name, promisify(fn), ...rest)) as T;
}

function wrapTest(register: Wrapped & { skip: Wrapped; only: Wrapped }) {
  return Object.assign(wrapRegister(register), {
    skip: wrapRegister(register.skip),
    only: wrapRegister(register.only),
  });
}

function wrapHook(register: (fn: () => unknown) => void) {
  return (fn: MochaStyleFunction) => register(promisify(fn) as () => unknown);
}

const mocha = globalThis as unknown as Record<string, unknown>;
mocha.it = wrapTest(
  it as unknown as Wrapped & { skip: Wrapped; only: Wrapped },
);

mocha.test = mocha.it;
mocha.context = describe;
mocha.before = wrapHook(beforeAll);
mocha.after = wrapHook(afterAll);
mocha.beforeEach = wrapHook(beforeEach);
mocha.afterEach = wrapHook(afterEach);

const setup = globalThis as typeof globalThis & {
  trustrootsServerTestSetup?: Promise<void>;
};

// The database is prepared once per process, before the first test file.
setup.trustrootsServerTestSetup ??= (async () => {
  if (process.env.SERVER_TEST_SKIP_DATABASE) return;
  const mongooseService =
    require('../../config/lib/mongoose.mjs') as MongooseService;
  const connection = await new Promise<Connection>(resolve =>
    mongooseService.connect(resolve),
  );
  await new Promise<void>((resolve, reject) =>
    mongooseService.dropDatabase(connection, error =>
      error ? reject(error) : resolve(),
    ),
  );
  await mongooseService.loadModels(() => {});
  await mongooseService.ensureIndexes(
    (require('mongoose') as typeof import('mongoose')).connection.modelNames(),
  );
})();

await setup.trustrootsServerTestSetup;
