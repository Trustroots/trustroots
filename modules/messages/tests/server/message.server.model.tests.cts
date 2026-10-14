import type {
  MessageDocument,
  MessageModel,
  MessageRecord,
  UserModelDocument,
  UserModel,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';
/**
 * Module dependencies.
 */
const should: typeof import('should') = require('should');
const mongoose: typeof import('mongoose') = require('mongoose');
const utils: typeof import('../../../../testutils/server/data.server.testutil') = require('../../../../testutils/server/data.server.testutil');

const User = mongoose.model<UserRecord, UserModel>('User');
const Message = mongoose.model<MessageRecord, MessageModel>('Message');

/**
 * Globals
 */
let userTo: UserModelDocument;
let userFrom: UserModelDocument;
let message: MessageDocument;

/**
 * Unit tests
 */
describe('Message Model Unit Tests:', function () {
  beforeEach(function (done) {
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
    userFrom.save(function () {
      userTo.save(function () {
        // Check id for userTo
        const findOneWithCallback = User.findOne as unknown as (
          this: UserModel,
          filter: { username: string },
          callback: (
            err: Error | null,
            userTo: UserModelDocument | null,
          ) => void,
        ) => void;
        findOneWithCallback.call(
          User,
          { username: userTo.username },
          function (_err, foundUser) {
            // Create message & continue
            message = new Message({
              content: 'Message content',
              userTo: foundUser!._id,
              read: false,
            });
            return done();
          },
        );
      });
    });
  });

  describe('Method Save', function () {
    it('should be able to save without problems', function (done) {
      message.save(function (err) {
        should.not.exist(err);
        return done();
      });
    });

    it('should be able to show an error when try to send without content', function (done) {
      message.set('userTo', '');

      message.save(function (err) {
        should.exist(err);
        return done();
      });
    });

    it('should be able to show an error when try to send without receiver', function (done) {
      message.content = '';

      message.save(function (err) {
        should.exist(err);
        return done();
      });
    });
  });
});
