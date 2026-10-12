/**
 * Module dependencies.
 */
require('should');
const mongoose = require('mongoose');
const utils = require('../../../../testutils/server/data.server.testutil');

const User = mongoose.model('User');
const Message = mongoose.model('Message');

/**
 * Globals
 */
let userTo;
let userFrom;
let message;

/**
 * Unit tests
 */
describe('Message Model Unit Tests:', function () {
  beforeEach(async function () {
    userFrom = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test1@test.com',
      username: 'username1',
      password: 'password123',
      provider: 'local',
    });
    userTo = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test2@test.com',
      username: 'username2',
      password: 'password123',
      provider: 'local',
    });

    afterEach(utils.clearDatabase);

    // Create users
    await userFrom.save();
    await userTo.save();
    // Check id for userTo
    const savedUserTo = await User.findOne({ username: userTo.username });
    // Create message & continue
    message = new Message({
      content: 'Message content',
      userTo: savedUserTo._id,
      read: false,
    });
  });

  describe('Method Save', function () {
    it('should be able to save without problems', async function () {
      await message.save();
    });

    it('should be able to show an error when try to send without content', async function () {
      message.userTo = '';

      await message.save().should.be.rejected();
    });

    it('should be able to show an error when try to send without receiver', async function () {
      message.content = '';

      await message.save().should.be.rejected();
    });
  });
});
