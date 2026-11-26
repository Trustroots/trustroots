import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import * as actionToken from '../../../server/services/action-token.server.service.mts';
import type {
  UserModel,
  UserRecord,
} from '../../../../../testutils/server/model-contracts.mts';

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
    for (const legacy of [{}, { $locals: {} }]) {
      assert.equal(
        emailToken({ ...legacy, emailToken: 'legacy-token' }, 'emailToken'),
        'legacy-token',
      );
    }
  });
  it('matches raw links against hashes and legacy tokens but rejects bearer digests', function () {
    for (const valid of ['sample-token', 'a'.repeat(1024)]) {
      assert.deepEqual(matchToken(valid), { $in: [hashToken(valid), valid] });
    }
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
