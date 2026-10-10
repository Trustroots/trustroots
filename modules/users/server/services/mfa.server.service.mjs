import crypto from 'node:crypto';
import mongoose from 'mongoose';
import config from '../../../../config/config.mjs';

const User = mongoose.model('User');
const TOTP_PERIOD_SECONDS = 30;
const TOTP_WINDOW = 1;
const PENDING_MINUTES = 10;
const CHALLENGE_MINUTES = 5;
const PRIVILEGED_ROLES = ['admin', 'moderator', 'welcome-team'];

function base32Encode(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const output = [];
  for (const character of input.toUpperCase().replace(/=+$/u, '')) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('Invalid authenticator secret.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function encryptionKey() {
  const encoded = config.mfaEncryptionKey;
  if (!encoded) throw new Error('MFA_ENCRYPTION_KEY is required.');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encoded) {
    throw new Error('MFA_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  }
  return key;
}

function encryptSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map(part => part.toString('base64url'))
    .join('.');
}

function decryptSecret(value) {
  const [ivValue, tagValue, ciphertextValue] = String(value || '').split('.');
  if (!ivValue || !tagValue || !ciphertextValue) {
    throw new Error('Invalid encrypted authenticator secret.');
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function normaliseCode(code) {
  return String(code || '')
    .replace(/[\s-]/gu, '')
    .toUpperCase();
}

function recoveryHash(code) {
  return crypto.createHash('sha256').update(normaliseCode(code)).digest('hex');
}

function totpCounter(secret, counter) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter % 0x100000000, 4);
  const digest = crypto
    .createHmac('sha1', base32Decode(secret))
    .update(counterBuffer)
    .digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 1000000).padStart(6, '0');
}

function matchingCounter(secret, code, now = Date.now()) {
  if (!/^\d{6}$/u.test(code)) return null;
  const current = Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);
  for (
    let counter = current - TOTP_WINDOW;
    counter <= current + TOTP_WINDOW;
    counter += 1
  ) {
    const expected = totpCounter(secret, counter);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))) {
      return counter;
    }
  }
  return null;
}

function createRecoveryCodes() {
  return Array.from({ length: 10 }, () =>
    crypto.randomBytes(8).toString('hex').toUpperCase(),
  );
}

function isPrivileged(user) {
  return (user?.roles || []).some(role => PRIVILEGED_ROLES.includes(role));
}

function provisioningUri(secret, username) {
  const label = encodeURIComponent(`Trustroots:${username}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=Trustroots&algorithm=SHA1&digits=6&period=${TOTP_PERIOD_SECONDS}`;
}

async function stageEnrollment(userId, username) {
  const secret = base32Encode(crypto.randomBytes(20));
  const encrypted = encryptSecret(secret);
  const expires = new Date(Date.now() + PENDING_MINUTES * 60 * 1000);
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        mfaPendingSecretEncrypted: encrypted,
        mfaPendingSecretExpires: expires,
        mfaPendingLastTotpCounter: -1,
      },
    },
  ).exec();
  return { provisioningUri: provisioningUri(secret, username), expires };
}

async function activateEnrollment(userId, code, now = Date.now()) {
  const user = await User.findById(userId)
    .select('+mfaPendingSecretEncrypted +mfaPendingSecretExpires')
    .exec();
  if (
    !user?.mfaPendingSecretEncrypted ||
    !user.mfaPendingSecretExpires ||
    user.mfaPendingSecretExpires.getTime() <= now
  ) {
    return null;
  }
  const secret = decryptSecret(user.mfaPendingSecretEncrypted);
  const counter = matchingCounter(secret, normaliseCode(code), now);
  if (counter === null) return null;
  const codes = createRecoveryCodes();
  const hashes = codes.map(recoveryHash);
  const updated = await User.findOneAndUpdate(
    {
      _id: userId,
      mfaEnabled: { $ne: true },
      mfaPendingSecretEncrypted: user.mfaPendingSecretEncrypted,
      mfaPendingSecretExpires: { $gt: new Date(now) },
      mfaPendingLastTotpCounter: { $lt: counter },
    },
    {
      $set: {
        mfaEnabled: true,
        mfaSecretEncrypted: user.mfaPendingSecretEncrypted,
        mfaRecoveryCodeHashes: hashes,
        mfaLastTotpCounter: counter,
      },
      $unset: {
        mfaPendingSecretEncrypted: 1,
        mfaPendingSecretExpires: 1,
        mfaPendingLastTotpCounter: 1,
      },
      $inc: { authVersion: 1 },
    },
    { new: true },
  ).exec();
  if (!updated) return null;
  return { codes, user: updated };
}

async function verifyAndConsume(
  userId,
  code,
  now = Date.now(),
  expectedAuthVersion,
) {
  const user = await User.findById(userId)
    .select('+mfaSecretEncrypted +mfaRecoveryCodeHashes')
    .exec();
  if (!user?.mfaEnabled || !user.mfaSecretEncrypted) return null;
  if (
    expectedAuthVersion !== undefined &&
    (user.authVersion || 0) !== expectedAuthVersion
  ) {
    return null;
  }
  const candidate = normaliseCode(code);
  const secret = decryptSecret(user.mfaSecretEncrypted);
  const counter = matchingCounter(secret, candidate, now);
  if (counter !== null) {
    const updated = await User.findOneAndUpdate(
      {
        _id: userId,
        mfaEnabled: true,
        mfaSecretEncrypted: user.mfaSecretEncrypted,
        roles: { $nin: ['suspended'] },
        ...(expectedAuthVersion !== undefined
          ? { authVersion: expectedAuthVersion }
          : {}),
        mfaLastTotpCounter: { $lt: counter },
      },
      { $set: { mfaLastTotpCounter: counter } },
      { new: true },
    ).exec();
    return updated
      ? { user: updated, recovery: false, secret: user.mfaSecretEncrypted }
      : null;
  }

  if (!/^[A-F0-9]{16}$/u.test(candidate)) return null;
  const hash = recoveryHash(candidate);
  const updated = await User.findOneAndUpdate(
    {
      _id: userId,
      mfaEnabled: true,
      mfaSecretEncrypted: user.mfaSecretEncrypted,
      mfaRecoveryCodeHashes: hash,
      roles: { $nin: ['suspended'] },
      ...(expectedAuthVersion !== undefined
        ? { authVersion: expectedAuthVersion }
        : {}),
    },
    { $pull: { mfaRecoveryCodeHashes: hash } },
    { new: true },
  ).exec();
  return updated
    ? { user: updated, recovery: true, secret: user.mfaSecretEncrypted }
    : null;
}

async function removeMfa(userId, expectedSecret) {
  if (!expectedSecret) return null;
  const updated = await User.findOneAndUpdate(
    {
      _id: userId,
      mfaEnabled: true,
      mfaSecretEncrypted: expectedSecret,
    },
    {
      $set: { mfaEnabled: false, mfaRecoveryCodeHashes: [] },
      $unset: {
        mfaSecretEncrypted: 1,
        mfaPendingSecretEncrypted: 1,
        mfaPendingSecretExpires: 1,
        mfaPendingLastTotpCounter: 1,
      },
      $inc: { authVersion: 1 },
    },
    { new: true },
  ).exec();
  return updated;
}

function createChallenge(user) {
  return {
    userId: String(user._id),
    authVersion: user.authVersion || 0,
    expiresAt: Date.now() + CHALLENGE_MINUTES * 60 * 1000,
  };
}

function challengeIsValid(challenge) {
  return Boolean(
    challenge &&
      typeof challenge.userId === 'string' &&
      Number.isInteger(challenge.authVersion) &&
      Number.isFinite(challenge.expiresAt) &&
      challenge.expiresAt > Date.now(),
  );
}

const service = {
  activateEnrollment,
  challengeIsValid,
  createChallenge,
  decryptSecret,
  encryptSecret,
  isPrivileged,
  createRecoveryCodes,
  hashRecoveryCode: recoveryHash,
  matchingCounter,
  removeMfa,
  stageEnrollment,
  verifyAndConsume,
};

export default service;
export {
  activateEnrollment,
  challengeIsValid,
  createChallenge,
  decryptSecret,
  encryptSecret,
  isPrivileged,
  createRecoveryCodes,
  recoveryHash as hashRecoveryCode,
  matchingCounter,
  removeMfa,
  stageEnrollment,
  verifyAndConsume,
};
