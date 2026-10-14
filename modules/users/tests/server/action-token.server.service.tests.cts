import type {
  UserModel,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose: typeof import('mongoose') = require('mongoose');
const actionToken: typeof import('../../server/services/action-token.server.service.mjs') = require('../../server/services/action-token.server.service.mjs');
const { hashToken, matchToken, setToken, emailToken } = actionToken;
const User = mongoose.model<UserRecord, UserModel>('User');

describe('Account action token digests', function () {
  it('stores a digest while keeping the raw value only in document locals', function () {
    const user = new User();
    setToken(user, 'emailToken', 'fictional-random-token');
    assert.equal(user.emailToken, hashToken('fictional-random-token'));
    assert.equal(emailToken(user, 'emailToken'), 'fictional-random-token');
    assert.ok(
      !JSON.stringify(user.toObject()).includes('fictional-random-token'),
    );
  });
  it('supports plain reminder objects and legacy mail payloads', function () {
    const user: {
      emailToken?: string;
      $locals?: { actionTokens?: Record<string, string> };
    } = {};
    setToken(user, 'emailToken', 'reminder-token');
    assert.equal(emailToken(user, 'emailToken'), 'reminder-token');
    assert.equal(
      emailToken({ emailToken: 'legacy-token' }, 'emailToken'),
      'legacy-token',
    );
  });
  it('matches raw links against hashes and legacy tokens but rejects bearer digests', function () {
    assert.deepEqual(matchToken('sample-token'), {
      $in: [hashToken('sample-token'), 'sample-token'],
    });
    for (const invalid of [
      undefined,
      {},
      '',
      'a'.repeat(1025),
      hashToken('sample-token'),
    ]) {
      assert.deepEqual(matchToken(invalid), { $in: [] });
    }
  });
});
