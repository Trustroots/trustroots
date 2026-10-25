import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
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

interface SupertestTest {
  app: Server;
  url: string;
  _server?: Server;
  serverAddress(app: Server, path: string): string;
  end(fn: (error: unknown) => void): SupertestTest;
}

const setup = globalThis as typeof globalThis & {
  trustrootsServerTestSetup?: Promise<void>;
  trustrootsSupertestLoopback?: true;
};

// Supertest sends requests to 127.0.0.1 but listens on the dual-stack `::`.
// macOS hands such a listener a port that another socket already holds on
// 127.0.0.1, and the request then reaches that socket instead. Listening on
// 127.0.0.1 makes the kernel skip those ports. Binding to a host is
// asynchronous, so the request waits for the port.
if (!setup.trustrootsSupertestLoopback) {
  setup.trustrootsSupertestLoopback = true;
  const { Test } = require('supertest') as {
    Test: { prototype: SupertestTest };
  };
  const { serverAddress, end } = Test.prototype;
  const pendingPorts = new WeakMap<Server, Promise<number>>();
  const requestTargets = new WeakMap<
    SupertestTest,
    { port: Promise<number>; path: string }
  >();
  Test.prototype.serverAddress = function (app, path) {
    if (app.address()) return serverAddress.call(this, app, path);
    let port = pendingPorts.get(app);
    if (!port) {
      this._server = app.listen(0, '127.0.0.1');
      port = once(app, 'listening').then(
        () => {
          pendingPorts.delete(app);
          return (app.address() as AddressInfo).port;
        },
        error => {
          pendingPorts.delete(app);
          throw error;
        },
      );
      pendingPorts.set(app, port);
    }
    requestTargets.set(this, { port, path });
    return `http://127.0.0.1${path}`;
  };
  Test.prototype.end = function (fn) {
    const target = requestTargets.get(this);
    if (!target) return end.call(this, fn);
    target.port.then(port => {
      this.url = `http://127.0.0.1:${port}${target.path}`;
      end.call(this, fn);
    }, fn);
    return this;
  };
}

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
