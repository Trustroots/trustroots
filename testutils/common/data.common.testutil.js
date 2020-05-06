/**
 * Various shared client/server functions that repeat in tests a lot
 */

const faker = require('faker');
const mongo = require('mongodb');
const _ = require('lodash');

function generateId() {
  return new mongo.ObjectId().toString();
}

const selectRandom = (list, fraction = 0.5) => {
  const count = Math.floor(list.length * fraction);
  return _.sampleSize(list, count);
};

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
    password: faker.internet.password(),
    ...overrides,
  };
}

function generateClientUser(overrides = {}) {
  return {
    _id: generateId(),
    displayName: faker.name.findName(),
    ...generateBaseUser(),
    ...overrides,
  };
}

/**
 * Generate user objects.
 * @returns {object[]} array of user data
 */
function generateUsers(
  count,
  { public: pub, locale } = {},
  type = 'server',
  tribes = [],
) {
  return _.range(count).map(() => {
    switch (type) {
      case 'server':
        return generateServerUser({ public: pub, locale });
      case 'client':
        return generateClientUser({
          memberIds: selectRandom(tribes, 0.4).map(tribe => tribe._id),
        });
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
  return referenceData.map(function (data) {
    const defaultReference = {
      userFrom: users[data[0]]._id,
      userTo: users[data[1]]._id,
      public: true,
      interactions: {
        met: faker.random.boolean(),
        hostedMe: faker.random.boolean(),
        hostedThem: faker.random.boolean(),
      },
      recommend: _.sample(['yes', 'no', 'unknown']),
    };

    return _.defaultsDeep({}, data[2], defaultReference);
  });
}

const tribeImageUUIDs = [
  '171433b0-853b-4d19-a8b4-44def956696d',
  '22028fde-5302-4172-954d-f54949afd7e4',
  'e69eb05f-773f-423c-9246-43629b5a8baf',
  '3c8bb9f1-e313-4baa-bf4c-1d8994fd6c6c',
  'd5563f29-669f-4f18-9802-d1924ff31364',
  '4ff6463d-c482-4be6-9a49-294fc8712d83',
  'e4466aa6-46f1-460f-94ef-8cec882d7103',
  '12a2c124-a38a-4df8-8987-e01ee3741727',
  'e23060e2-393d-4b4a-b469-450053538f8a',
  '6274fd88-9178-4cea-8bb4-60f22e4cc904',
  'fb2b6d50-9d51-4755-9b44-1395fae4cf5d',
  '656e4872-15a4-4be4-8059-6e7c39b07c5d',
  'e060263a-9684-4065-85f3-460e9fffbd40',
  'ad2062d0-aadd-475d-bf85-2cd2e30a9d38',
  'bfaf468a-2c48-4798-b1bb-bffd0c6b716b',
  '0fd49df4-88e7-4380-b38a-3625e4b02dde',
  'cef34c15-b527-4f89-a7a5-456f62ff9ce2',
  'c84f93f1-421d-4339-a61f-a5efc2d24297',
  'd4a04ce4-3aeb-43a4-882b-43b1974d86e0',
  '310f68af-3e77-451e-96a7-09132d26fdb4',
  'dcb0ed04-cdd6-45ea-b773-e09320a4f759',
  '434018c8-4f4f-4054-9bd2-6618e9d5a77f',
  '0ce0abdf-6898-4191-9a86-4f03807291b5',
  '0ebcabec-2bc5-4eee-ab17-991b9dd52eae',
  '4f7805e7-b5e6-4b40-bb32-3aafbe1bbc74',
  '69a500a4-a16e-4c4d-9981-84fbe310d531',
];

const generateTribe = index => ({
  _id: generateId(),
  label: faker.lorem.word() + '_' + index,
  labelHistory: faker.random.words(),
  slugHistory: faker.random.words(),
  synonyms: faker.random.words(),
  color: faker.internet.color().slice(1),
  count: Math.floor(Math.random() * 50000),
  created: Date.now(),
  modified: Date.now(),
  public: true,
  image_UUID: _.sample(tribeImageUUIDs),
  attribution: faker.name.findName(),
  attribution_url: faker.internet.url(),
  description: faker.lorem.sentences(),
});

const generateTribes = count => _.range(count).map(i => generateTribe(i));

module.exports = {
  generateId,
  generateClientUser,
  generateUsers,
  generateReferences,
  generateTribes,
};
