import type {
  MessageDocument,
  MessageModel,
  MessageRecord,
  MessageStatModel,
  MessageStatRecord,
  UserModel,
  UserModelDocument,
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
const MessageStat = mongoose.model<MessageStatRecord, MessageStatModel>(
  'MessageStat',
);
/**
 * Globals
 */
let user0: UserModelDocument;
let user1: UserModelDocument;
let message: MessageDocument;
/**
 * Unit tests
 */
describe('MessageStats Model', function () {
  beforeEach(function (/* done */) {
    user0 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test1@test.com',
      username: 'username1',
      password: 'password123',
      provider: 'local',
    });
    user1 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test2@test.com',
      username: 'username2',
      password: 'password123',
      provider: 'local',
    });
    message = new Message({
      content: 'Message content',
      userFrom: user0._id,
      userTo: user1._id,
      read: false,
    });
  });
  afterEach(utils.clearDatabase);
  it('new MessageStat should have specific fields', function () {
    const messageStat = new MessageStat({
      firstMessageUserFrom: user0._id,
      firstMessageUserTo: user1._id,
      firstMessageCreated: message.created,
      firstMessageLength: message.content!.length,
    });
    messageStat.should.have.property('_id');
    messageStat.should.have.property('firstMessageUserFrom');
    messageStat.should.have.property('firstMessageUserTo');
    messageStat.should.have.property('firstMessageCreated');
    messageStat.should.have.property('firstMessageLength');
    messageStat.should.have.property('firstReplyCreated', null);
    messageStat.should.have.property('firstReplyLength', null);
    messageStat.should.have.property('timeToFirstReply', null);
  });
  // the expected fields:
  // firstMessageUserFrom: id of the first sender
  // firstMessageUserTo: id of the first receiver
  // firstMessageCreated: Date
  // firstMessageLength: number
  // firstReplyCreated: Date
  // firstReplyLength: number
  // timeToFirstReply: number
  // // messageCount: number (not now)
  it('should save without problems', function (done) {
    const messageStat = new MessageStat({
      firstMessageUserFrom: user0._id,
      firstMessageUserTo: user1._id,
      firstMessageCreated: message.created,
      firstMessageLength: message.content!.length,
    });
    messageStat
      .save()
      .then(() => {
        should.not.exist(null);
        return done();
      })
      .catch(done);
  });
});
