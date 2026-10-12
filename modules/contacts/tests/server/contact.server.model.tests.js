/**
 * Module dependencies.
 */
require('should');
const mongoose = require('mongoose');
const utils = require('../../../../testutils/server/data.server.testutil');

const User = mongoose.model('User');
const Contact = mongoose.model('Contact');

/**
 * Globals
 */
let user1;
let user2;
let user1Id;
let user2Id;
let contact;

/**
 * Unit tests
 */
describe('Contact Model Unit Tests:', function () {
  beforeEach(async function () {
    user1 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test1@test.com',
      username: 'username1',
      password: 'password123!',
      provider: 'local',
    });

    user2 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test2@test.com',
      username: 'username2',
      password: 'password123!',
      provider: 'local',
    });

    await user1.save();
    user1Id = user1._id;

    await user2.save();
    user2Id = user2._id;

    // Create connection between users
    contact = new Contact({
      userFrom: user1Id,
      userTo: user2Id,
      created: new Date(),
      confirmed: true,
    });
  });

  afterEach(utils.clearDatabase);

  describe('Method Save', function () {
    it('should be able to save without problems', async function () {
      await contact.save();
    });

    it('should be able to show an error when try to save without `userFrom`', async function () {
      contact.userFrom = '';

      await contact.save().should.be.rejected();
    });

    it('should be able to show an error when try to save without `userTo`', async function () {
      contact.userTo = '';

      await contact.save().should.be.rejected();
    });
  });
});
