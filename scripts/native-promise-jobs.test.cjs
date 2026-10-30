const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const { setImmediate: nextTurn } = require('node:timers/promises');
const { runInNewContext } = require('node:vm');
const test = require('node:test');

test('experience seeding keeps at most 100 saves active and drains failures before disconnecting', async () => {
  const ts = require('typescript');
  const pending = [];
  let active = 0;
  let peak = 0;
  let saved = 0;
  let disconnected = false;
  const users = Array.from({ length: 40 }, (_, i) => ({
    _id: i,
    username: `member${i}`,
  }));
  class Experience {
    static findOne = async () => null;
    save() {
      peak = Math.max(peak, ++active);
      return new Promise((resolve, reject) =>
        pending.push(() => {
          active--;
          saved++;
          if (saved === 1) reject(new Error('save failed'));
          else resolve();
        }),
      );
    }
  }
  const helper = {
    connect: done => done(),
    loadModels: done => done(),
    disconnect: () => {
      disconnected = true;
    },
  };
  const argv = new Proxy(
    {},
    {
      get: (_, name) =>
        name === 'parseSync'
          ? () => ({ averageNumberPerProfile: 20, replyRate: 1 })
          : () => argv,
    },
  );
  const code = ts.transpileModule(
    readFileSync('bin/fillTestData/Experiences.mts', 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: 'seed.ts',
    },
  ).outputText;
  runInNewContext(code, {
    exports: {},
    Math: Object.assign(Object.create(Math), { random: () => 0.25 }),
    require: name => {
      if (name.includes('config/lib/mongoose')) return helper;
      if (name.includes('config/config')) return { db: {} };
      if (name === 'yargs') return () => argv;
      if (name === 'mongoose')
        return {
          model: name =>
            name === 'Experience'
              ? Experience
              : { find: () => ({ sort: async () => users }) },
        };
      return require(name);
    },
    process: { argv: [] },
    console: { log() {}, error() {} },
    setInterval: () => 1,
    clearInterval() {},
  });
  await nextTurn();
  assert.equal(active, 100);
  assert.equal(disconnected, false);
  while (pending.length) {
    pending.shift()();
    await nextTurn();
  }
  assert.equal(peak, 100);
  assert.ok(saved > 100);
  assert.equal(disconnected, true);
});

test('mass mail waits for delivery, records success and delays before fetching the next group', async () => {
  const events = [];
  const deliveries = [];
  let queries = 0;
  class Store {
    find() {
      events.push('find');
      return {
        limit: () => ({
          exec: done => done(null, queries++ < 2 ? [{ _id: queries }] : []),
        }),
      };
    }
    update() {
      events.push('update');
    }
  }
  class SparkPost {
    transmissions = {
      send: (_, done) => {
        events.push('send');
        deliveries.push(done);
      },
    };
  }
  runInNewContext(
    stripTypeScriptTypes(
      readFileSync('scripts/mass-email/sendMassMail.cts', 'utf8'),
    ),
    {
      require: name => {
        if (name === 'nedb') return Store;
        if (name === 'sparkpost') return SparkPost;
        if (name === 'shortid') return { generate: () => 'fictional-batch' };
        return require(name);
      },
      console: { log() {} },
      setTimeout: done => {
        events.push('delay');
        done();
      },
    },
  );
  await nextTurn();
  assert.deepEqual(events, ['find', 'send']);
  deliveries.shift()(null, {});
  await nextTurn();
  assert.deepEqual(events, ['find', 'send', 'update', 'delay', 'find', 'send']);
  deliveries.shift()(new Error('delivery failed'));
  await nextTurn();
  assert.equal(queries, 2);
  assert.equal(events.filter(event => event === 'update').length, 1);
});

test('historical signup export limits delivery to five and drains failures before disconnecting', async () => {
  const pending = [];
  let active = 0;
  let maximum = 0;
  let disconnected = false;
  let exited = false;
  const docs = Array.from({ length: 12 }, () => ({ created: new Date() }));
  const model = {
    countDocuments: async () => docs.length,
    find: () => ({ exec: async () => docs }),
  };
  const helper = {
    connect: done => done(),
    disconnect: done => {
      disconnected = true;
      done();
    },
  };
  const stat = {
    stat: (_, done) => {
      maximum = Math.max(maximum, ++active);
      pending.push(() => {
        active--;
        done(new Error('delivery failed'));
      });
    },
  };
  runInNewContext(
    stripTypeScriptTypes(
      readFileSync('scripts/influxdb/fill-signups-to-influx.cts', 'utf8'),
    ),
    {
      require: name => {
        if (name === 'mongoose') return { model: () => model };
        if (name === 'yargs/yargs') return () => ({ parseSync: () => ({}) });
        if (name.includes('config/lib/mongoose')) return helper;
        if (name.includes('stats.server.service')) return stat;
        return {};
      },
      console: { log() {}, warn() {}, error() {} },
      process: {
        argv: [],
        stdout: { clearLine() {}, cursorTo() {}, write() {} },
        exit: () => {
          exited = true;
        },
      },
    },
  );
  await nextTurn();
  assert.equal(active, 5);
  assert.equal(disconnected, false);
  while (pending.length) {
    pending.shift()();
    await nextTurn();
  }
  assert.equal(maximum, 5);
  assert.equal(active, 0);
  assert.equal(disconnected, true);
  assert.equal(exited, true);
});

test('member count export disconnects and fails when its query rejects', async () => {
  const events = [];
  const processStub = {};
  runInNewContext(
    stripTypeScriptTypes(
      readFileSync('scripts/influxdb/fill-member-count-to-influx.cts', 'utf8'),
    ),
    {
      require: name => {
        if (name === 'mongoose')
          return {
            model: () => ({
              countDocuments: async () => {
                throw new Error('query failed');
              },
            }),
          };
        if (name.includes('config/lib/mongoose'))
          return {
            connect: done => done(),
            disconnect: done => {
              events.push('disconnect');
              done(new Error('disconnect failed'));
            },
          };
        return {};
      },
      console: { log() {}, error() {} },
      process: processStub,
    },
  );
  await nextTurn();
  assert.equal(processStub.exitCode, 1);
  assert.deepEqual(events, ['disconnect']);
});

test('duplicate contact cleanup reports a final count failure as a non-zero exit', async () => {
  const exits = [];
  let counts = 0;
  const model = {
    countDocuments: async () => {
      if (++counts === 2) throw new Error('count failed');
      return 2;
    },
    aggregate: async () => [{ ids: ['original', 'duplicate'], count: 2 }],
    findByIdAndDelete: async () => {},
  };
  runInNewContext(
    stripTypeScriptTypes(
      readFileSync(
        'scripts/db-maintenance/remove-duplicate-contacts.cts',
        'utf8',
      ),
    ),
    {
      require: name => {
        if (name === 'mongoose')
          return { model: () => model, set() {}, connect: async () => {} };
        return { db: { uri: 'mongodb://example.invalid/test' } };
      },
      console: { log() {}, error() {} },
      process: { exit: code => exits.push(code) },
    },
  );
  await nextTurn();
  assert.equal(counts, 2);
  assert.deepEqual(exits, [1]);
});
