const assert = require('assert/strict');
const {
  hashToken,
} = require('../../server/services/action-token.server.service.mjs');
const {
  EMAIL_CONFIRMATION_LEGACY_DEADLINE,
  EMAIL_CONFIRMATION_LIFETIME_MS,
  emailConfirmationTokenQuery,
  setEmailConfirmationToken,
} = require('../../server/services/email-confirmation.server.service.mjs');

describe('Email confirmation token lifecycle', function () {
  it('stores a digest and a fixed 24-hour lifetime', function () {
    const issuedAt = new Date('2026-10-12T12:00:00.000Z');
    const user = {};
    setEmailConfirmationToken(user, 'fictional-confirmation-token', issuedAt);

    assert.equal(user.emailToken, hashToken('fictional-confirmation-token'));
    assert.equal(user.emailTokenIssuedAt.getTime(), issuedAt.getTime());
    assert.equal(
      user.emailTokenExpires.getTime(),
      issuedAt.getTime() + EMAIL_CONFIRMATION_LIFETIME_MS,
    );
    assert.equal(
      user.$locals.actionTokens.emailToken,
      'fictional-confirmation-token',
    );
  });

  it('rejects a token at its expiry boundary', function () {
    const now = new Date('2026-10-13T12:00:00.000Z');
    const query = emailConfirmationTokenQuery(
      'fictional-confirmation-token',
      now,
    );

    assert.deepEqual(query.$or[0], { emailTokenExpires: { $gt: now } });
    assert.deepEqual(query.$or[1], { emailTokenExpires: { $exists: false } });
  });

  it('accepts legacy tokens until 1 November 2026', function () {
    const now = new Date(EMAIL_CONFIRMATION_LEGACY_DEADLINE.getTime() - 1);
    const query = emailConfirmationTokenQuery(
      'fictional-confirmation-token',
      now,
    );

    assert.equal(
      EMAIL_CONFIRMATION_LEGACY_DEADLINE.toISOString(),
      '2026-11-01T00:00:00.000Z',
    );
    assert.deepEqual(query.$or[1], { emailTokenExpires: { $exists: false } });
  });

  it('stops accepting legacy tokens on 1 November 2026', function () {
    const now = new Date(EMAIL_CONFIRMATION_LEGACY_DEADLINE);
    const query = emailConfirmationTokenQuery(
      'fictional-confirmation-token',
      now,
    );

    assert.deepEqual(query.$or, [{ emailTokenExpires: { $gt: now } }]);
  });

  it('uses a current timestamp when no validation time is supplied', function () {
    const before = Date.now();
    const query = emailConfirmationTokenQuery('fictional-confirmation-token');
    const after = Date.now();
    const now = query.$or[0].emailTokenExpires.$gt;

    assert.ok(now instanceof Date);
    assert.ok(now.getTime() >= before && now.getTime() <= after);
  });
});
