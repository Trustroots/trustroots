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
import '../../layers/shell/shared/route-manifest.mts';

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

// Wraps the whole chainable API (`it.skip`, `it.skipIf(x)`, `it.todo`, …) and
// converts the callback wherever it sits: `it(name, fn)` or
// `it(name, { timeout }, fn)`. `each` rows are parameters, not `done`.
function wrapTest<T extends Wrapped>(register: T): T {
  return new Proxy(register, {
    apply(target, thisArg, args: unknown[]) {
      const index = args.findIndex(arg => typeof arg === 'function');
      const converted = args.map((arg, i) =>
        i === index ? promisify(arg as MochaStyleFunction) : arg,
      );
      const result = Reflect.apply(target, thisArg, converted);
      return typeof result === 'function'
        ? wrapTest(result as Wrapped)
        : result;
    },
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (property === 'each' || typeof value !== 'function') return value;
      return wrapTest(value.bind(target) as Wrapped);
    },
  });
}

function wrapHook(register: (fn: () => unknown) => void) {
  return (fn: MochaStyleFunction) => register(promisify(fn) as () => unknown);
}

const mocha = globalThis as unknown as Record<string, unknown>;
mocha.it = wrapTest(it as unknown as Wrapped);

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
