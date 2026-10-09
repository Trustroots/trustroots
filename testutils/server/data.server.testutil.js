/**
 * Various server functions that repeat in tests a lot
 */

const faker = require('faker');
const mongoose = require('mongoose');

// Only the opt-in fixture helper uses this process-local cache.
const fixturePasswordHashes = new Map();

const {
  generateUsers,
  generateExperiences,
  generateValidUsername,
} = require('../common/data.common.testutil');

/**
 * Save documents to mongodb
 * @param {string} collection - name of mongoose model (mongodb collection)
 * @param {object[]} _documents - array of document data
 * @returns {Promise<Document[]>}
 */
async function saveDocumentsToCollection(
  collection,
  _docs,
  reusePasswords = false,
) {
  const docs = _docs.map(_doc => {
    const Model = mongoose.model(collection);
    return new Model(_doc);
  });

  for (const doc of docs) {
    if (
      reusePasswords &&
      typeof doc.password === 'string' &&
      doc.password.length >= 8
    ) {
      // Validate plaintext before substituting a hash. Keep all other save hooks,
      // including display-name and email-hash generation, running normally.
      await doc.validate();
      const password = doc.password;
      if (!fixturePasswordHashes.has(password)) {
        fixturePasswordHashes.set(
          password,
          await doc.constructor.hashPassword(password),
        );
      }
      doc.password = fixturePasswordHashes.get(password);
      doc.salt = undefined;
      doc.unmarkModified('password');
    }
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
async function saveUserFixtures(_docs, done, reusePasswords) {
  try {
    const docs = await saveDocumentsToCollection('User', _docs, reusePasswords);
    done(null, docs);
    return docs;
  } catch (e) {
    done(e);
    throw e;
  }
}

function saveUsers(_docs, done = () => {}) {
  return saveUserFixtures(_docs, done, false);
}

/**
 * Generate unrelated user fixtures with repeatable plaintext credentials, so
 * saveUsersWithCachedPasswords can reuse a hash even across regenerated users.
 * Authentication and password tests must keep using generateUsers.
 * @param {number} count - number of users
 * @param {object} [options] - ordinary generateUsers options
 * @returns {object[]} user fixtures with unique identities
 */
function generateUsersWithSharedPassword(count, options = {}) {
  return generateUsers(count, options).map(user => ({
    ...user,
    password: 'SharedFixturePassword123!',
  }));
}

/**
 * Save unrelated test fixtures with real, reusable password hashes. Authentication
 * and password tests must use saveUsers or User.save to exercise fresh hashing.
 * Input objects and their plaintext credentials remain available for signIn.
 * @param {object[]} docs - user fixture data
 * @param {Function} [done] - optional callback
 * @returns {Promise<object[]>} saved user documents
 */
function saveUsersWithCachedPasswords(docs, done = () => {}) {
  return saveUserFixtures(docs, done, true);
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
    username: generateValidUsername(),
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
  generateUsersWithSharedPassword,
  saveUsers,
  saveUsersWithCachedPasswords,
  createTestUser,
  generateExperiences,
  saveExperiences,
  clearDatabase,
  signIn,
  signOut,
};
