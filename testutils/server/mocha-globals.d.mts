// Globals installed by testutils/server/vitest.setup.mts.
declare global {
  type TestDone = (error?: unknown) => void;
  type TestBody = (this: unknown, done: TestDone) => unknown;
  type TestOptions = { timeout?: number };

  interface TestRegistrar {
    (name: string, fn?: TestBody): void;
    (name: string, options: TestOptions, fn: TestBody): void;
    skip: TestRegistrar;
    only: TestRegistrar;
  }

  const describe: TestRegistrar;
  const context: TestRegistrar;
  const it: TestRegistrar;
  const test: TestRegistrar;
  function before(fn: TestBody): void;
  function after(fn: TestBody): void;
  function beforeEach(fn: TestBody): void;
  function afterEach(fn: TestBody): void;
}

export {};
