const profileDeletion: typeof import('../../server/services/profile-deletion.server.service.mts') = require('../../server/services/profile-deletion.server.service.mts');
const { isProfileDeletionPending } = profileDeletion;
require('should');

describe('Admin profile deletion service', () => {
  const now = Date.UTC(2026, 0, 1);

  it('returns false when the user or token is missing', () => {
    isProfileDeletionPending(null, now).should.equal(false);
    isProfileDeletionPending(undefined, now).should.equal(false);
    isProfileDeletionPending({}, now).should.equal(false);
  });

  it('treats a missing or invalid expiry as pending when a token exists', () => {
    isProfileDeletionPending({ removeProfileToken: 'token' }, now).should.equal(
      true,
    );
    isProfileDeletionPending(
      { removeProfileToken: 'token', removeProfileExpires: 0 },
      now,
    ).should.equal(true);
    isProfileDeletionPending(
      { removeProfileToken: 'token', removeProfileExpires: '' },
      now,
    ).should.equal(true);
    isProfileDeletionPending(
      { removeProfileToken: 'token', removeProfileExpires: 'invalid' },
      now,
    ).should.equal(true);
  });

  it('treats a future expiry as pending', () => {
    isProfileDeletionPending(
      { removeProfileToken: 'token', removeProfileExpires: new Date(now + 1) },
      now,
    ).should.equal(true);
  });

  it('treats an expiry equal to or earlier than now as expired', () => {
    isProfileDeletionPending(
      { removeProfileToken: 'token', removeProfileExpires: new Date(now) },
      now,
    ).should.equal(false);
    isProfileDeletionPending(
      { removeProfileToken: 'token', removeProfileExpires: new Date(now - 1) },
      now,
    ).should.equal(false);
  });
});
