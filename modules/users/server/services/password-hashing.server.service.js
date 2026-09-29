const crypto = require('node:crypto');

const CURRENT_VERSION = 'v=1';
const CURRENT_PARAMETERS = 'ln=17,r=8,p=1';
const CURRENT_N = 2 ** 17;
const CURRENT_R = 8;
const CURRENT_P = 1;
const SALT_BYTES = 16;
const KEY_BYTES = 32;
const MAX_MEMORY_BYTES = 160 * 1024 * 1024;
const LEGACY_ITERATIONS = 10000;
const LEGACY_KEY_BYTES = 64;
const LEGACY_DIGEST = 'sha1';
const MAX_ACTIVE_KDFS = 1;
const MAX_QUEUED_KDFS = 16;
const DUMMY_SALT = Buffer.alloc(SALT_BYTES, 0);
const DUMMY_KEY = Buffer.alloc(KEY_BYTES, 0);

class KdfOverloadedError extends Error {
  constructor() {
    super('Password service is temporarily busy. Please try again.');
    this.name = 'KdfOverloadedError';
    this.code = 'KDF_OVERLOADED';
    this.status = 503;
    this.userFacing = true;
  }
}

function createKdfScheduler({ maxActive, maxQueued }) {
  if (!Number.isInteger(maxActive) || maxActive < 1) {
    throw new TypeError('maxActive must be a positive integer.');
  }
  if (!Number.isInteger(maxQueued) || maxQueued < 0) {
    throw new TypeError('maxQueued must be a non-negative integer.');
  }

  let active = 0;
  const waiting = [];

  function start({ task, resolve, reject }) {
    active += 1;
    Promise.resolve()
      .then(task)
      .then(resolve, reject)
      .finally(() => {
        active -= 1;
        const next = waiting.shift();
        if (next) start(next);
      });
  }

  return {
    run(task) {
      if (typeof task !== 'function') {
        return Promise.reject(new TypeError('task must be a function.'));
      }

      return new Promise((resolve, reject) => {
        const request = { task, resolve, reject };
        if (active < maxActive) {
          start(request);
          return;
        }

        if (waiting.length >= maxQueued) {
          reject(new KdfOverloadedError());
          return;
        }

        waiting.push(request);
      });
    },

    getState() {
      return { active, queued: waiting.length };
    },
  };
}

const kdfScheduler = createKdfScheduler({
  maxActive: MAX_ACTIVE_KDFS,
  maxQueued: MAX_QUEUED_KDFS,
});

function requirePassword(password) {
  if (typeof password !== 'string') {
    throw new TypeError('password must be a string.');
  }
}

function deriveScrypt(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      KEY_BYTES,
      {
        N: CURRENT_N,
        r: CURRENT_R,
        p: CURRENT_P,
        maxmem: MAX_MEMORY_BYTES,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      },
    );
  });
}

function derivePbkdf2(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      salt,
      LEGACY_ITERATIONS,
      LEGACY_KEY_BYTES,
      LEGACY_DIGEST,
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      },
    );
  });
}

function decodeBase64Url(value, byteLength) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
    return null;
  }

  const decoded = Buffer.from(value, 'base64url');
  if (
    decoded.length !== byteLength ||
    decoded.toString('base64url') !== value
  ) {
    return null;
  }
  return decoded;
}

function decodeBase64(value, byteLength) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    return null;
  }

  const decoded = Buffer.from(value, 'base64');
  if (decoded.length !== byteLength || decoded.toString('base64') !== value) {
    return null;
  }
  return decoded;
}

function parseCurrentHash(storedPassword) {
  const parts = storedPassword.split('$');
  if (
    parts.length !== 6 ||
    parts[0] !== '' ||
    parts[1] !== 'scrypt' ||
    parts[2] !== CURRENT_VERSION ||
    parts[3] !== CURRENT_PARAMETERS
  ) {
    return null;
  }

  const salt = decodeBase64Url(parts[4], SALT_BYTES);
  const expectedKey = decodeBase64Url(parts[5], KEY_BYTES);
  if (!salt || !expectedKey) return null;

  return { salt, expectedKey };
}

function timingSafeMatch(actualKey, expectedKey) {
  return (
    Buffer.isBuffer(actualKey) &&
    Buffer.isBuffer(expectedKey) &&
    actualKey.length === expectedKey.length &&
    crypto.timingSafeEqual(actualKey, expectedKey)
  );
}

async function deriveCurrent(password, salt) {
  return kdfScheduler.run(() => deriveScrypt(password, salt));
}

async function hashPassword(password) {
  requirePassword(password);
  const salt = crypto.randomBytes(SALT_BYTES);
  const derivedKey = await deriveCurrent(password, salt);
  return [
    '',
    'scrypt',
    CURRENT_VERSION,
    CURRENT_PARAMETERS,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

async function dummyVerifyPassword(password) {
  const candidate = typeof password === 'string' ? password : '';
  const derivedKey = await deriveCurrent(candidate, DUMMY_SALT);
  return timingSafeMatch(derivedKey, DUMMY_KEY);
}

async function verifyCurrentPassword(password, storedPassword, legacySalt) {
  const parsed = parseCurrentHash(storedPassword);
  if (
    !parsed ||
    (legacySalt !== undefined && legacySalt !== null && legacySalt !== '')
  ) {
    await dummyVerifyPassword(password);
    return { valid: false, needsRehash: false };
  }

  const derivedKey = await deriveCurrent(password, parsed.salt);
  return {
    valid: timingSafeMatch(derivedKey, parsed.expectedKey),
    needsRehash: false,
  };
}

async function verifyLegacyPassword(password, storedPassword, legacySalt) {
  const expectedKey = decodeBase64(storedPassword, LEGACY_KEY_BYTES);
  const salt = decodeBase64(legacySalt, SALT_BYTES);
  if (!expectedKey || !salt) {
    await dummyVerifyPassword(password);
    return { valid: false, needsRehash: false };
  }

  const actualKey = await kdfScheduler.run(() => derivePbkdf2(password, salt));
  const valid = timingSafeMatch(actualKey, expectedKey);
  if (!valid) await dummyVerifyPassword(password);
  return { valid, needsRehash: valid };
}

async function verifyPassword(password, storedPassword, legacySalt) {
  const candidate = typeof password === 'string' ? password : '';
  if (
    typeof storedPassword === 'string' &&
    storedPassword.startsWith('$scrypt$')
  ) {
    return verifyCurrentPassword(candidate, storedPassword, legacySalt);
  }

  if (legacySalt !== undefined && legacySalt !== null && legacySalt !== '') {
    return verifyLegacyPassword(candidate, storedPassword, legacySalt);
  }

  await dummyVerifyPassword(candidate);
  return { valid: false, needsRehash: false };
}

function getKdfState() {
  return kdfScheduler.getState();
}

module.exports = {
  KdfOverloadedError,
  createKdfScheduler,
  dummyVerifyPassword,
  getKdfState,
  hashPassword,
  verifyPassword,
};
