'use strict';

/**
 * Various functions that repeat in tests a lot
 */

var _ = require('lodash'),
    async = require('async'),
    crypto = require('crypto'),
    mongoose = require('mongoose');

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
 * @param {boolean} [defs.publ] - is the user public? (defaults to a random boolean)
 * @param {string} [defs.password] - password (defaults to a random password)
 * @returns {object[]} array of user data
 */
function generateUsers(count, defs) {
  defs = _.defaultsDeep(defs, {
    username: 'username',
    firstName: 'GivenName',
    lastName: 'FamilyName',
    email: 'user@example.com'
  });

  return _.range(count).map(function (i) {
    var username = defs.username + i;
    var firstName = defs.firstName + i;
    var lastName = defs.lastName + i;
    var email = i + defs.email;
    var publ = defs.hasOwnProperty('public') ? defs.public : !getRandInt(2); // public is reserved word
    var password = defs.password || crypto.randomBytes(24).toString('base64');

    return {
      public: publ,
      firstName: firstName,
      lastName: lastName,
      email: email,
      username: username,
      displayUsername: username,
      password: password
    };
  });
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
    var defaultReference = {
      userFrom: users[data[0]]._id,
      userTo: users[data[1]]._id,
      public: true,
      met: !getRandInt(2),
      hostedMe: !getRandInt(2),
      hostedThem: !getRandInt(2),
      recommend: ['yes', 'no', 'unknown'][getRandInt(3)]
    };

    return _.defaultsDeep({}, data[2], defaultReference);
  });
}

/**
 * @callback {saveDocumentsCallback}
 * @param {error|null} error
 * @param {object[]} documents - array of saved mongo documents
 */

/**
 * Save documents to mongodb
 * @param {string} collection - name of mongoose model (mongodb collection)
 * @param {object[]} _documents - array of document data
 * @param {saveDocumentsCallback} done
 */
function saveDocumentsToCollection(collection, _docs, done) {
  var docs = _docs.map(function (_doc) {
    var Model = mongoose.model(collection);
    return new Model(_doc);
  });

  async.eachSeries(docs, function (doc, cb) {
    doc.save(cb);
  }, function (err) {
    return done(err, docs);
  });
}

var saveUsers = _.curry(saveDocumentsToCollection)('User');
var saveReferences = _.curry(saveDocumentsToCollection)('Reference');

/**
 * Clear specified database collections
 * @param {string[]} - array of collection names to have all documents removed
 * @param {function} - callback
 */
function clearDatabase(collections, done) {
  var models = collections.map(function (collection) { return mongoose.model(collection);});

  async.eachSeries(models, function (Model, cb) {
    Model.deleteMany().exec(cb);
  }, done);
}

/**
 * Sign in to app
 * @param {object} credentials
 * @param {string} credentials.username
 * @param {string} credentials.password
 * @param {object} agent - supertest's agent
 * @param {function} done - callback
 */
function signIn(credentials, agent, done) {
  agent.post('/api/auth/signin')
    .send(credentials)
    .expect(200)
    .end(function (err) {
      return done(err);
    });
}

/**
 * Sign out from app
 * @param {object} agent - supertest's agent
 * @param {function} done - callback
 */
function signOut(agent, done) {
  agent.get('/api/auth/signout')
    .expect(302)
    .end(done);
}


module.exports = {
  generateUsers: generateUsers,
  saveUsers: saveUsers,
  generateReferences: generateReferences,
  saveReferences: saveReferences,
  clearDatabase: clearDatabase,
  signIn: signIn,
  signOut: signOut
};
