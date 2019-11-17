/**
 * Various functions that repeat in tests a lot
 */

const _ = require('lodash');
const crypto = require('crypto');
const mongoose = require('mongoose');

/**
 * Get random integer within [0, exclusiveMaximum)
 * Is not cryptographically secure!
 * @param {integer} exclusiveMaximum
 * @returns {integer} an integer in range [0, exclusiveMaximum), exclusiveMaximum is not included
 */
function getRandInt(exclusiveMaximum) {
  return Math.floor(exclusiveMaximum * Math.random());
}

/**
 * Generate user objects.
 * When running multiple times, username and email need to be specified and different to avoid conflict
 * @param {integer} count - how many users we create
 * @param {object} [defs] - default values for the users
 * @param {string} [defs.username=username] - username (will have a number appended)
 * @param {string} [defs.firstName=GivenName] - first name (will have a number appended)
 * @param {string} [defs.lastName=FamilyName] - last name (will have a number appended)
 * @param {string} [defs.email=user(at)example.com] - email (will have a number prepended)
 * @param {string} [defs.locale=] - locale (preferred language)
 * @param {boolean} [defs.publ] - is the user public? (defaults to a random boolean)
 * @param {string} [defs.password] - password (defaults to a random password)
 * @returns {object[]} array of user data
 */
function generateUsers(count, { username='username', firstName='GivenName', lastName='FamilyName', email='user@example.com', locale='', public: pub, roles=['user'], password }={ }) {

  return _.range(count).map(i => ({
    public: (typeof pub === 'boolean') ? pub : !getRandInt(2),
    firstName: firstName + i,
    lastName: lastName + i,
    email: i + email,
    username: username + i,
    locale,
    roles,
    password: password || crypto.randomBytes(24).toString('base64')
  }));
}

/**
 * Generate reference objects.
 * @param {object[]} users - array of mongodb User
 * @param {[number, number, object][]} referenceData - array of data for each reference
 * @param {number} referenceData[][0] - index of userFrom in users
 * @param {number} referenceData[][1] - index of userTo in users
 * @param {object} referenceData[][2] - object of property: value to override default reference properties
 */
function generateReferences(users, referenceData) {
  return referenceData.map(function (data) {
    const defaultReference = {
      userFrom: users[data[0]]._id,
      userTo: users[data[1]]._id,
      public: true,
      interactions: {
        met: !getRandInt(2),
        hostedMe: !getRandInt(2),
        hostedThem: !getRandInt(2)
      },
      recommend: ['yes', 'no', 'unknown'][getRandInt(3)]
    };

    return _.defaultsDeep({}, data[2], defaultReference);
  });
}

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
async function saveUsers(_docs, done=() => {}) {
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
 * @param {Reference[]} _docs - Reference documents to save
 * @param {callback} [done] - optional callback
 * @returns {Promise<Reference[]>}
 * the callback support can be removed when the whole codebase is migrated to ES6
 */
async function saveReferences(_docs, done=() => {}) {
  try {
    const docs = await saveDocumentsToCollection('Reference', _docs);
    done(null, docs);
    return docs;
  } catch (e) {
    done(e);
    throw e;
  }
}

/**
 * Clear specified database collections
 * @param {string[]} collections - array of collection names to have all documents removed
 * @returns {Promise<void>}
 */
async function clearDatabaseCollections(collections) {
  const models = collections.map(collection => mongoose.model(collection));

  for (const Model of models) {
    await Model.deleteMany().exec();
  }
}

/**
 * This is a list of the collections to clear
 * The new collections should be added as needed
 * Eventually this list shall become complete
 */
const collections = [
  'User',
  'Reference'
];

/**
 * Clear all collections in a database
 * Usage in mocha: afterEach(clearDatabase)
 * @returns {Promise<void>}
 */
async function clearDatabase() {
  await clearDatabaseCollections(collections);
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
  await agent.post('/api/auth/signin')
    .send({ username, password })
    .expect(200);
}

/**
 * Sign out from app
 * @param {object} agent - supertest's agent
 * @returns {Promise<void>}
 */
async function signOut(agent) {
  await agent.get('/api/auth/signout')
    .expect(302);
}


module.exports = {
  generateUsers,
  saveUsers,
  generateReferences,
  saveReferences,
  clearDatabase,
  signIn,
  signOut
};
