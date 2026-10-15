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
    userFrom
      .save()
      .then(function () {
        userTo
          .save()
          .then(function () {
            // Check id for userTo
            User.findOne({ username: userTo.username }).then(foundUser => {
              // Create message & continue
              message = new Message({
                content: 'Message content',
                userTo: foundUser!._id,
                read: false,
              });
              return done();
            }, done);
          })
          .catch(done);
      })
      .catch(done);
  });
  describe('Method Save', function () {
    it('should be able to save without problems', function (done) {
      message
        .save()
        .then(() => {
          should.not.exist(null);
          return done();
        })
        .catch(done);
    });
    it('should be able to show an error when try to send without content', function (done) {
      message.set('userTo', '');
      message
        .save()
        .then(
          () => {
            throw new Error('Expected the operation to reject');
          },
          err => {
            should.exist(err);
            return done();
          },
        )
        .catch(done);
    });
    it('should be able to show an error when try to send without receiver', function (done) {
      message.content = '';
      message
        .save()
        .then(
          () => {
            throw new Error('Expected the operation to reject');
          },
          err => {
            should.exist(err);
            return done();
          },
        )
        .catch(done);
    });
  });
});
