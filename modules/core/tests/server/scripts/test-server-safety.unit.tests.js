const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

describe('Server test runner safety', function () {
  it('refuses to start outside NODE_ENV=test before connecting to a database', function () {
    const script = path.resolve('scripts/test-server.js');
    const result = spawnSync(process.execPath, [script], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'development',
        DB_1_PORT_27017_TCP_ADDR: '127.0.0.1:1',
      },
      encoding: 'utf8',
      timeout: 5000,
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /require NODE_ENV=test; refusing to connect/);
    assert.doesNotMatch(result.stderr, /MongoServerSelectionError/);
  });
});
