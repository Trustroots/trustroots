const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const fs = require('node:fs') as typeof import('node:fs');
const os = require('node:os') as typeof import('node:os');
const path = require('node:path') as typeof import('node:path');
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

  it('records one duration per test file', () => {
    const file = path.join(
      process.cwd(),
      'modules/example/tests/server/fixture.cts',
    );
    const other = path.join(
      process.cwd(),
      'modules/example/tests/server/instant.cts',
    );
    recordTimings(
      [
        { moduleId: file, diagnostic: () => ({ duration: 72.5 }) },
        { moduleId: other, diagnostic: () => ({ duration: 0 }) },
      ],
      path.join(directory, 'nested', 'worker-1.json'),
    );
    assert.deepEqual(readTimings(path.join(directory, 'nested')), {
      [path.relative(process.cwd(), file)]: 72.5,
      [path.relative(process.cwd(), other)]: 1,
    });
  });
});
