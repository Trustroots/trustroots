const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const sinon = require('sinon');
const {
  createPlan,
  runWorkers,
  cleanupDatabases,
} = require('../../../../../scripts/test-server-parallel');
const { MongoClient } = require('mongodb');

const files = [
  'modules/users/tests/server/user.server.model.tests.js',
  'modules/contacts/tests/server/contact-moderation.server.routes.tests.js',
  'modules/experiences/tests/server/experience-suggestion.server.routes.tests.js',
];
const token = '012345abcdef';

function fakeWorkers(plan, options = {}) {
  const signals = new EventEmitter();
  const children = [];
  const cleanup = sinon.stub().resolves();
  const spawnProcess = sinon.spy((_executable, _args, spawnOptions) => {
    const child = new EventEmitter();
    child.options = spawnOptions;
    child.kill = sinon.spy(signal => child.emit('exit', null, signal));
    children.push(child);
    return child;
  });
  const result = runWorkers(plan, {
    env: {
      DB_1_PORT_27017_TCP_ADDR: '127.0.0.1:27017',
      NODE_OPTIONS: '--import /fictional/coverage-preloader.mjs',
      NYC_CONFIG: '/fictional/coverage-config.json',
    },
    signals,
    cleanup,
    spawnProcess,
    log: () => {},
    ...options,
  });
  return { signals, children, cleanup, spawnProcess, result };
}

describe('Parallel server test orchestration', () => {
  afterEach(() => sinon.restore());

  it('partitions all selected files exactly once and balances deterministic weights', () => {
    const first = createPlan([...files, files[0], `./${files[0]}`], 2, token);
    assert.deepEqual(first, createPlan([...files].reverse(), 2, token));
    assert.deepEqual(
      first.flatMap(worker => worker.files).sort(),
      [...files].sort(),
    );
    assert.equal(first.length, 2);
    assert.equal(new Set(first.map(worker => worker.database)).size, 2);
    assert.ok(first.every(worker => worker.files.length));
  });

  it('uses different databases for simultaneous invocations and caps workers by file count', () => {
    const first = createPlan(files, 8);
    const second = createPlan(files, 8);
    assert.equal(first.length, files.length);
    assert.ok(
      first.every(
        worker => !second.some(other => other.database === worker.database),
      ),
    );
  });

  it('rejects invalid worker counts, paths, tokens and empty selections', () => {
    for (const count of [0, 9, -1, 'two', '2.5', '']) {
      assert.throws(
        () => createPlan(files, count, token),
        /SERVER_TEST_WORKERS/,
      );
    }
    assert.throws(() => createPlan(files, 2, 'invalid'), /token/);
    assert.throws(
      () => createPlan(['server.js'], 2, token),
      /Not a server test/,
    );
    assert.throws(() => createPlan([], 2, token), /No server test/);
  });

  it('runs workers concurrently with isolated test-only configuration and waits for all', async () => {
    const plan = createPlan(files, 2, token);
    const run = fakeWorkers(plan);
    assert.equal(run.spawnProcess.callCount, 2);
    run.children.forEach((child, index) => {
      assert.equal(
        child.options.env.TRUSTROOTS_SERVER_TEST_DATABASE,
        plan[index].database,
      );
      assert.equal(
        child.options.env.SERVER_TEST_FILES,
        plan[index].files.join(','),
      );
      assert.equal(child.options.env.TRUSTROOTS_SKIP_LOCAL_CONFIG, 'true');
      assert.equal(child.options.env.NODE_ENV, 'test');
      assert.equal(
        child.options.env.NODE_OPTIONS,
        '--import /fictional/coverage-preloader.mjs',
      );
      assert.equal(
        child.options.env.NYC_CONFIG,
        '/fictional/coverage-config.json',
      );
    });
    run.children[0].emit('exit', 0, null);
    await Promise.resolve();
    sinon.assert.notCalled(run.cleanup);
    run.children[1].emit('exit', 0, null);
    assert.equal(await run.result, 0);
    sinon.assert.calledOnce(run.cleanup);
    assert.equal(run.signals.listenerCount('SIGINT'), 0);
    assert.equal(run.signals.listenerCount('SIGTERM'), 0);
  });

  it('reports a failed worker after waiting for its peers and cleaning up', async () => {
    const run = fakeWorkers(createPlan(files, 2, token));
    run.children[0].emit('exit', 1, null);
    run.children[1].emit('exit', 0, null);
    assert.equal(await run.result, 1);
    sinon.assert.calledOnce(run.cleanup);
  });

  it('handles asynchronous and synchronous spawn failures', async () => {
    const plan = createPlan(files, 1, token);
    const run = fakeWorkers(plan);
    run.children[0].emit('error', new Error('unavailable'));
    assert.equal(await run.result, 1);
    sinon.assert.calledOnce(run.cleanup);
    const failed = fakeWorkers(plan, {
      spawnProcess: () => {
        throw new Error('unavailable');
      },
    });
    assert.equal(await failed.result, 1);
    sinon.assert.calledOnce(failed.cleanup);
  });

  for (const [signal, code] of [
    ['SIGINT', 130],
    ['SIGTERM', 143],
  ]) {
    it(`terminates workers and cleans their databases on ${signal}`, async () => {
      const run = fakeWorkers(createPlan(files, 2, token));
      run.signals.emit(signal);
      assert.equal(await run.result, code);
      run.children.forEach(child =>
        sinon.assert.calledOnceWithExactly(child.kill, signal),
      );
      sinon.assert.calledOnce(run.cleanup);
    });
  }

  it('reports cleanup failures and still removes signal handlers', async () => {
    const run = fakeWorkers(createPlan(files, 1, token), {
      cleanup: sinon.stub().rejects(new Error('cleanup failed')),
    });
    run.children[0].emit('exit', 0, null);
    await assert.rejects(run.result, /cleanup failed/);
    assert.equal(run.signals.listenerCount('SIGINT'), 0);
  });

  it('drops only the planned worker databases and closes the MongoDB client', async () => {
    const dropDatabase = sinon.stub().resolves();
    const database = sinon
      .stub(MongoClient.prototype, 'db')
      .returns({ dropDatabase });
    sinon.stub(MongoClient.prototype, 'connect').resolves();
    const close = sinon.stub(MongoClient.prototype, 'close').resolves();
    const plan = createPlan(files, 2, token);
    await cleanupDatabases(plan, {
      DB_1_PORT_27017_TCP_ADDR: '127.0.0.1:27017',
    });
    assert.deepEqual(
      database.args.map(([name]) => name),
      plan.map(worker => worker.database),
    );
    assert.equal(dropDatabase.callCount, 2);
    sinon.assert.calledOnce(close);
  });

  it('closes the client when database cleanup fails', async () => {
    sinon.stub(MongoClient.prototype, 'connect').resolves();
    sinon.stub(MongoClient.prototype, 'db').returns({
      dropDatabase: sinon.stub().rejects(new Error('drop failed')),
    });
    const close = sinon.stub(MongoClient.prototype, 'close').resolves();
    await assert.rejects(
      cleanupDatabases(createPlan(files, 1, token), {}),
      /drop failed/,
    );
    sinon.assert.calledOnce(close);
  });

  it('accepts only test-worker database names in the test environment', async () => {
    const originalEnvironment = process.env.NODE_ENV;
    const originalDatabase = process.env.TRUSTROOTS_SERVER_TEST_DATABASE;
    const url = pathToFileURL(
      path.resolve(__dirname, '../../../../../config/env/test.mjs'),
    );
    try {
      process.env.NODE_ENV = 'test';
      for (const invalid of [
        'trustroots',
        'trustroots-test',
        '',
        'trustroots-test-worker-bad-1',
      ]) {
        process.env.TRUSTROOTS_SERVER_TEST_DATABASE = invalid;
        await assert.rejects(
          import(`${url}?invalid=${encodeURIComponent(invalid)}`),
          /Invalid TRUSTROOTS_SERVER_TEST_DATABASE/,
        );
      }
      const database = `trustroots-test-worker-${token}-1`;
      process.env.TRUSTROOTS_SERVER_TEST_DATABASE = database;
      assert.ok(
        (await import(`${url}?valid`)).default.db.uri.endsWith(`/${database}`),
      );
      delete process.env.TRUSTROOTS_SERVER_TEST_DATABASE;
      assert.ok(
        (await import(`${url}?serial`)).default.db.uri.endsWith(
          '/trustroots-test',
        ),
      );
      process.env.NODE_ENV = 'production';
      process.env.TRUSTROOTS_SERVER_TEST_DATABASE = 'application-database';
      assert.ok(
        (await import(`${url}?production`)).default.db.uri.endsWith(
          '/trustroots-test',
        ),
      );
    } finally {
      if (originalEnvironment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalEnvironment;
      if (originalDatabase === undefined)
        delete process.env.TRUSTROOTS_SERVER_TEST_DATABASE;
      else process.env.TRUSTROOTS_SERVER_TEST_DATABASE = originalDatabase;
    }
  });
});
