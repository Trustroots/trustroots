import crypto from 'node:crypto';

import appConfig from './app-config.mts';
import { findUserByUsername, updateUserByUsername, withE2eDb } from './db.mts';

const fixtureSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

/** Provision an anonymous admin fixture and return a fresh single-use code. */
export async function provisionFixtureMfa(user: { username: string }) {
  const stored = await findUserByUsername(user.username);
  const isAdmin = stored?.roles?.includes('admin') === true;
  if (!isAdmin) return null;

  if (!stored.mfaEnabled) {
    const key = Buffer.from(appConfig.mfaEncryptionKey, 'base64');
    if (key.length !== 32) {
      throw new Error('The e2e MFA encryption key is unavailable.');
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(fixtureSecret, 'utf8'),
      cipher.final(),
    ]);
    const encrypted = [iv, cipher.getAuthTag(), ciphertext]
      .map(part => part.toString('base64url'))
      .join('.');
    await withE2eDb(db =>
      db.collection('users').updateOne(
        { username: user.username, mfaEnabled: { $ne: true } },
        {
          $set: {
            mfaEnabled: true,
            mfaSecretEncrypted: encrypted,
            mfaLastTotpCounter: -1,
          },
        },
      ),
    );
  }

  const code = crypto.randomBytes(8).toString('hex').toUpperCase();
  const hash = crypto
    .createHmac('sha256', Buffer.from(appConfig.mfaEncryptionKey, 'base64'))
    .update(code)
    .digest('hex');
  await updateUserByUsername(user.username, {
    $push: { mfaRecoveryCodeHashes: hash },
  });
  return code;
}
