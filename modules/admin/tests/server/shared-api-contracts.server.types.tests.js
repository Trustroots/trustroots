const assert = require('assert/strict');
const { execFileSync } = require('child_process');
const path = require('path');

describe('Shared API contract compiler regressions', function () {
  this.timeout(30000);
  const root = path.resolve(__dirname, '../../../..');
  function diagnostics(file, before, after) {
    // Release each compiler's memory before the next case and avoid inheriting
    // coverage hooks: these checks read source code rather than execute it.
    const output = execFileSync(
      process.execPath,
      [
        path.join(__dirname, '../fixtures/shared-api-contract-diagnostics.js'),
        JSON.stringify({ root, file, before, after }),
      ],
      { env: { ...process.env, NODE_OPTIONS: '' }, encoding: 'utf8' },
    );
    return JSON.parse(output);
  }

  it('checks the unmodified shared contracts and server payload builders', () => {
    assert.deepEqual(diagnostics(), []);
  });

  it('rejects a missing staff-blocker response field in the actual implementation', () => {
    const errors = diagnostics(
      'modules/admin/server/services/staff-blockers-payload.server.service.mjs',
      'blockedBy: blockers',
      'blockers: blockers',
    );
    assert(errors.some(item => item.messageText.includes('blockedBy')));
  });

  it('rejects an invalid recommendation in the actual experience response builder', () => {
    const errors = diagnostics(
      'modules/experiences/server/services/experience-payload.server.service.mjs',
      'recommend: experience.recommend',
      "recommend: 'sometimes'",
    );
    assert(errors.some(item => item.code === 2322));
  });

  it('rejects an invalid field in the actual create-request builder', () => {
    const errors = diagnostics(
      'modules/experiences/server/services/experience-payload.server.service.mjs',
      'return { ...body, userFrom, public: isPublic };',
      'return { ...body, userTo: 123, userFrom, public: isPublic };',
    );
    assert(errors.some(item => item.code === 2322));
  });

  it('rejects a formatted string in the actual experience count response', () => {
    const errors = diagnostics(
      'modules/experiences/server/services/experience-payload.server.service.mjs',
      'count: privateCount + publicCount',
      'count: String(privateCount + publicCount)',
    );
    assert(errors.some(item => item.code === 2322));
  });
});
