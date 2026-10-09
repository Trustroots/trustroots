const crypto = require('node:crypto');
const { findUserByUsername, updateUserByUsername, withE2eDb } = require('./db');

// Enrol privileged fixtures and support fixtures already enrolled by a test.
// Authentication uses the real challenge and a fresh single-use recovery code.
async function provisionFixtureMfa(user) {
  const stored = await findUserByUsername(user.username);
  if (
    !stored?.mfaEnabled &&
    !stored?.roles?.some(role =>
      ['admin', 'moderator', 'welcome-team'].includes(role),
    )
  ) {
    return null;
  }
  if (!stored.mfaEnabled) {
    const config = require('./app-config');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(config.mfaEncryptionKey, 'base64'),
      iv,
    );
    const encrypted = Buffer.concat([
      cipher.update('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 'utf8'),
      cipher.final(),
    ]);
    const secret = [iv, cipher.getAuthTag(), encrypted]
      .map(part => part.toString('base64url'))
      .join('.');
    await withE2eDb(db =>
      db.collection('users').updateOne(
        { username: user.username, mfaEnabled: { $ne: true } },
        {
          $set: {
            mfaEnabled: true,
            mfaSecretEncrypted: secret,
            mfaLastTotpCounter: -1,
          },
        },
      ),
    );
  }
  const code = crypto.randomBytes(8).toString('hex').toUpperCase();
  const hash = crypto.createHash('sha256').update(code).digest('hex');
  await updateUserByUsername(user.username, {
    $push: { mfaRecoveryCodeHashes: hash },
  });
  return code;
}

module.exports = { provisionFixtureMfa };
