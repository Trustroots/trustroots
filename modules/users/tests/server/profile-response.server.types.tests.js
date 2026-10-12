const assert = require('assert/strict');
const { execFileSync } = require('child_process');
const path = require('path');

describe('Profile API contract compiler regressions', function () {
  this.timeout(30000);
  const root = path.resolve(__dirname, '../../../..');

  function diagnostics(before, after) {
    const output = execFileSync(
      process.execPath,
      [
        path.join(__dirname, '../fixtures/profile-contract-diagnostics.js'),
        JSON.stringify({ root, before, after }),
      ],
      { env: { ...process.env, NODE_OPTIONS: '' }, encoding: 'utf8' },
    );
    return JSON.parse(output);
  }

  it('rejects an incompatible public-profile value in the real builder', () => {
    const errors = diagnostics(
      'displayName: profile.displayName,',
      'displayName: true,',
    );
    assert(errors.some(item => item.code === 2322));
  });

  it('rejects removing the required identity from the real public builder', () => {
    const errors = diagnostics(
      '_id: profile._id,',
      'username: profile.username,',
    );
    assert(errors.some(item => item.messageText.includes('_id')));
  });
});
