const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs = require('node:fs') as typeof import('node:fs');
const os = require('node:os') as typeof import('node:os');
const path = require('node:path') as typeof import('node:path');
const Mocha = require('mocha') as typeof import('mocha');
const {
  readTimings,
  recordTimings,
} = require('../../../../../scripts/server-test-timings.cts');

describe('Server test file timings', () => {
  let directory: string;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'server-timings-'));
  });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  it('ignores missing, malformed and invalid timing data', () => {
    assert.deepEqual(readTimings(path.join(directory, 'missing')), {});
    fs.writeFileSync(
      path.join(directory, 'worker-1.json'),
      JSON.stringify({ 'a.cts': 12, 'b.cts': 0, 'c.cts': -1, 'd.cts': '10' }),
    );
    fs.writeFileSync(path.join(directory, 'worker-2.json'), '{');
    fs.writeFileSync(path.join(directory, 'worker-3.json'), 'null');
    fs.writeFileSync(path.join(directory, 'ignored.txt'), '{}');
    assert.deepEqual(readTimings(directory), { 'a.cts': 12 });
  });

  it('records actual Mocha suite hooks and root tests without double counting', async () => {
    const mocha = new Mocha({ reporter: Mocha.reporters.Base });
    let time = 0;
    const file = path.join(
      process.cwd(),
      'modules/example/tests/server/fixture.cts',
    );
    const suite = Mocha.Suite.create(mocha.suite, 'outer');
    suite.file = file;
    suite.beforeAll(() => {
      time += 20;
    });
    suite.afterAll(() => {
      time += 30;
    });
    const nested = Mocha.Suite.create(suite, 'nested');
    nested.file = file;
    const test = new Mocha.Test('test', () => {
      time += 10;
    });
    test.file = file;
    nested.addTest(test);
    const rootTest = new Mocha.Test('root test', () => {
      time += 5;
    });
    rootTest.file = file;
    mocha.suite.addTest(rootTest);
    const second = Mocha.Suite.create(mocha.suite, 'second top-level suite');
    second.file = file;
    second.addTest(
      new Mocha.Test('second', () => {
        time += 7;
      }),
    );
    await new Promise<void>((resolve, reject) => {
      const runner = mocha.run(failures =>
        failures ? reject(new Error('fixture failed')) : resolve(),
      );
      recordTimings(runner, path.join(directory, 'worker-1.json'), () => time);
    });
    assert.deepEqual(readTimings(directory), {
      [path.relative(process.cwd(), file)]: 72,
    });
  });
});
