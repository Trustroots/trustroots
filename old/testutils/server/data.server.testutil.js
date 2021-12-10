/**
 * Various server functions that repeat in tests a lot
 */

const mongoose = require('mongoose');

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
  await agent.get('/api/auth/signout').expect(302);
}

module.exports = {
  generateUsers,
  saveUsers,
  generateExperiences,
  saveExperiences,
  clearDatabase,
  signIn,
  signOut,
};
