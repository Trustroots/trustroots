/**
 * Various server functions that repeat in tests a lot
 */

const faker = require('faker');
const mongoose = require('mongoose');
const crypto = require('crypto');

const {
  generateUsers,
  generateExperiences,
} = require('../common/data.common.testutil');

/**
 * Save documents to mongodb
 * @param {string} collection - name of mongoose model (mongodb collection)
 * @param {object[]} _documents - array of document data
 * @returns {Promise<Document[]>}
 */
async function saveDocumentsToCollection(collection, _docs) {
  const docs = _docs.map(_doc => {
    const Model = mongoose.model(collection);
    return new Model(_doc);
  });

  for (const doc of docs) {
    await doc.save();
  }

  return docs;
}

/**
 * save users to database calls callback if provided and returns Promise with saved documents
 * @param {User[]} _docs - User documents to save
 * @param {callback} [done] - optional callback
 * @returns {Promise<User[]>}
 * the callback support can be removed when the whole codebase is migrated to ES6
 */
async function saveUsers(_docs, done = () => {}) {
  try {
    const docs = await saveDocumentsToCollection('User', _docs);
    done(null, docs);
    return docs;
  } catch (e) {
    done(e);
    throw e;
  }
}

/**
 * Create an unsaved User document with the defaults most tests rely on.
 *
 * Username and email default to generated unique values, the same mechanism
 * `generateUsers` uses, so users from different tests do not collide. Pass
 * explicit values via overrides when a test needs to know them upfront,
 * e.g. to sign in with them.
 *
 * Overrides are merged shallowly over the defaults. Setting an override key
 * to `undefined` leaves the key out entirely so the mongoose schema default
 * applies instead, e.g. `createTestUser({ public: undefined })` keeps the
 * schema default (`false`) rather than the `true` tests normally use.
 *
 * @param {object} [overrides] - user fields overriding the defaults
 * @returns {User} unsaved mongoose User document
 */
function createTestUser(overrides = {}) {
  const User = mongoose.model('User');
  const user = {
    firstName: 'Full',
    lastName: 'Name',
    displayName: 'Full Name',
    username: faker.internet.userName(),
    email: faker.internet.email(),
    password: 'Password123!',
    provider: 'local',
    public: true,
    roles: ['user'],
    ...overrides,
  };

  // Drop keys overridden with `undefined` so schema defaults apply.
  for (const key of Object.keys(user)) {
    if (user[key] === undefined) {
      delete user[key];
    }
  }

  return new User(user);
}

/**
 * save references to database calls callback if provided and returns Promise with saved documents
 * @param {Experience[]} _docs - Experience documents to save
 * @param {callback} [done] - optional callback
 * @returns {Promise<Experience[]>}
 * the callback support can be removed when the whole codebase is migrated to ES6
 */
async function saveExperiences(_docs, done = () => {}) {
  try {
    const docs = await saveDocumentsToCollection('Experience', _docs);
    done(null, docs);
    return docs;
  } catch (e) {
    done(e);
    throw e;
  }
}

/**
 * Clear all collections in a database
 * Usage in mocha: afterEach(clearDatabase)
 * @returns {Promise<void>}
 */
async function clearDatabase() {
  const collections = mongoose.modelNames();
  const models = collections.map(collection => mongoose.model(collection));

  for (const Model of models) {
    await Model.deleteMany().exec();
  }
}

/**
 * Sign in to app
 * @param {object} user
 * @param {string} user.username
 * @param {string} user.password
 * @param {object} agent - supertest's agent
 * @returns {Promise<void>}
 */
async function signIn(user, agent) {
  const { username, password } = user;
  await agent.post('/api/auth/signin').send({ username, password }).expect(200);
}

/**
 * Sign in a privileged test user through the real MFA challenge. The fixture
 * provisions a fixed test-only secret before password sign-in; access is still
 * granted only after the server verifies a current TOTP code.
 * @param {object} user
 * @param {object} agent - supertest's agent
 * @returns {Promise<void>}
 */
async function signInPrivileged(user, agent) {
  const User = mongoose.model('User');
  const storedUser = await User.findOne({ username: user.username }).exec();
  if (
    !storedUser ||
    !storedUser.roles.some(role =>
      ['admin', 'moderator', 'welcome-team'].includes(role),
    )
  ) {
    return signIn(user, agent);
  }

  const { default: mfaService } = await import(
    '../../modules/users/server/services/mfa.server.service.mjs'
  );
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  await User.updateOne(
    { _id: storedUser._id },
    {
      $set: {
        mfaEnabled: true,
        mfaSecretEncrypted: mfaService.encryptSecret(secret),
        mfaLastTotpCounter: -1,
        mfaRecoveryCodeHashes: [],
      },
    },
  ).exec();

  const { username, password } = user;
  await agent.post('/api/auth/signin').send({ username, password }).expect(202);

  const counter = Math.floor(Date.now() / 30000);
  const key = Buffer.from('12345678901234567890');
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter % 0x100000000, 4);
  const digest = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  const code = String(binary % 1000000).padStart(6, '0');

  await agent
    .post('/api/auth/mfa/verify')
    .set('X-Trustroots-Request', '1')
    .send({ code })
    .expect(200);
}

/**
 * Sign out from app
 * @param {object} agent - supertest's agent
 * @returns {Promise<void>}
 */
async function signOut(agent) {
  await agent
    .post('/api/auth/signout')
    .set('X-Trustroots-Request', '1')
    .expect(302);
}

module.exports = {
  generateUsers,
  saveUsers,
  createTestUser,
  generateExperiences,
  saveExperiences,
  clearDatabase,
  signIn,
  signInPrivileged,
  signOut,
};
