import faker from 'faker';
import { sample, sampleSize } from 'lodash';
import moment from 'moment';

/**
 * Most of the logic for creating the users and tribes is copied from @/bin/fillTestData/...
 * @TODO DRY if such DRYing makes sense
 */

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
  _id: String(index).repeat(10),
  get id() {
    return this._id;
  },
  label: faker.lorem.word() + '_' + index,
  labelHistory: faker.random.words(),
  slugHistory: faker.random.words(),
  synonyms: faker.random.words(),
  color: faker.internet.color().slice(1),
  count: Math.floor(Math.random() * 50000),
  created: Date.now(),
  modified: Date.now(),
  public: true,
  image_UUID: sample(tribeImageUUIDs),
  attribution: faker.name.findName(),
  attribution_url: faker.internet.url(),
  description: faker.lorem.sentences(),
});

const selectRandom = (list, fraction = 0.5) => {
  const count = Math.floor(list.length * fraction);
  return sampleSize(list, count);
};

const generateUser = (index, tribes) => ({
  _id: String(index).repeat(10),
  get id() {
    return this._id;
  },
  firstName: faker.name.firstName(),
  lastName: faker.name.lastName(),
  get displayName() {
    return `${this.firstName} ${this.lastName}`;
  },
  provider: 'local',
  public: true,
  avatarUploaded: false,
  avatarSource: 'none',
  welcomeSequenceStep: 3,
  seen: moment()
    .subtract(Math.random() * 365, 'd')
    .subtract(Math.random() * 24, 'h')
    .subtract(Math.random() * 3600, 's'),
  email: index + faker.internet.email(),
  password: faker.internet.password(),
  get username() {
    return this.displayName
      .toLowerCase()
      .replace(/'/g, '')
      .replace(/\s/g, '');
  },
  memberIds: selectRandom(tribes, 0.4).map(tribe => tribe._id),
});

const generateTribes = count =>
  [...Array(count).keys()].map(i => generateTribe(i));
const generateUsers = (count, tribes) =>
  [...Array(count).keys()].map(i => generateUser(i, tribes));

export default count => {
  const tribes = generateTribes(count.tribes);
  const users = generateUsers(count.users, tribes);
  return { tribes, users };
};
