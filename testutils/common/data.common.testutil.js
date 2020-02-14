/**
 * Various shared client/server functions that repeat in tests a lot
 */

const range = require('lodash/range');
const defaultsDeep = require('lodash/defaultsDeep');
const crypto = require('crypto');
const faker = require('faker');

/**
 * Get random integer within [0, exclusiveMaximum)
 * Is not cryptographically secure!
 * @param {integer} exclusiveMaximum
 * @returns {integer} an integer in range [0, exclusiveMaximum), exclusiveMaximum is not included
 */
function getRandInt(exclusiveMaximum) {
  return Math.floor(exclusiveMaximum * Math.random());
}

function generateMongoId() {
  return faker.random.alphaNumeric(24); // looks a bit like one!
}

function generateBaseUser() {
  return {
    username: faker.internet.userName(),
    firstName: faker.name.firstName(),
    lastName: faker.name.lastName(),
    email: faker.internet.email(),
    languages: [],
  };
}

function generateServerUser(overrides = {}) {
  return {
    ...generateBaseUser(),
    locale: '',
    public: faker.random.boolean(),
    roles: ['user'],
    password: crypto.randomBytes(24).toString('base64'),
    ...overrides,
  };
}

function generateClientUser(overrides = {}) {
  return {
    _id: generateMongoId(),
    displayName: faker.name.findName(),
    ...generateBaseUser(),
    ...overrides,
  };
}

/**
 * Generate user objects.
 * @returns {object[]} array of user data
 */
function generateUsers(count, { public: pub, locale } = {}, type = 'server') {
  return range(count).map(() => {
    switch (type) {
      case 'server':
        return generateServerUser({ public: pub, locale });
      case 'client':
        return generateClientUser();
    }
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
  return referenceData.map(function(data) {
    const defaultReference = {
      userFrom: users[data[0]]._id,
      userTo: users[data[1]]._id,
      public: true,
      interactions: {
        met: !getRandInt(2),
        hostedMe: !getRandInt(2),
        hostedThem: !getRandInt(2),
      },
      recommend: ['yes', 'no', 'unknown'][getRandInt(3)],
    };

    return defaultsDeep({}, data[2], defaultReference);
  });
}

module.exports = {
  generateMongoId,
  generateClientUser,
  generateUsers,
  generateReferences,
};
