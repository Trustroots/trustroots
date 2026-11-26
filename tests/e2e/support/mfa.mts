import crypto from 'node:crypto';
import type { Page } from '@playwright/test';

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

function decodeBase32(value: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let buffer = 0;
  const output = [];
  for (const character of value) {
    buffer = (buffer << 5) | alphabet.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      output.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function currentTotp(secret: string): string {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter % 0x100000000, 4);
  const digest = crypto
    .createHmac('sha1', decodeBase32(secret))
    .update(counterBuffer)
    .digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 1000000).padStart(6, '0');
}

export async function enrolAuthenticator(page: Page, password: string) {
  const settings = page.getByRole('region', { name: 'Authenticator MFA' });
  await settings.getByLabel('Confirm your password').fill(password);
  await settings.getByRole('button', { name: 'Set up authenticator' }).click();
  const provisioningText = await settings.locator('code').first().textContent();
  const secret =
    provisioningText && new URL(provisioningText).searchParams.get('secret');
  if (!secret) throw new Error('Authenticator setup link has no secret.');
  await settings
    .getByLabel('Current authenticator code')
    .fill(currentTotp(secret));
  await settings
    .getByRole('button', { name: 'Enable authenticator MFA' })
    .click();
}
