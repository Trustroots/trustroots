import type {
  MessageDocument,
  MessageModel,
  MessageRecord,
  MessageStatsPoint,
  TestConfigModule,
  UserModel,
  UserModelDocument,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';
/**
 * Module dependencies.
 */
const mongoose: typeof import('mongoose') = require('mongoose');
const _: typeof import('lodash') = require('lodash');
const sinon: typeof import('sinon') = require('sinon');
const winston: typeof import('winston') = require('winston');
const config: TestConfigModule = require('./../../../../config/config.mts');
const messageToStatsService: typeof import('./../../server/services/message-to-stats.server.service.mjs') = require('./../../server/services/message-to-stats.server.service.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil') = require('../../../../testutils/server/data.server.testutil');
require('should');
const User = mongoose.model<UserRecord, UserModel>('User');
const Message = mongoose.model<MessageRecord, MessageModel>('Message');
type MessageStatsService = {
  process(
    message: MessageDocument,
    callback: (error: Error | null, value: MessageStatsPoint) => void,
  ): void;
  save(message: MessageDocument, callback: (error: Error | null) => void): void;
};
const statsService = messageToStatsService as unknown as MessageStatsService;
// for testing length of long or short messages
const longMessageMinimumLength = config.limits.longMessageMinimumLength;
/**
 * Unit tests
 */
describe('Message to stats server service Unit Tests:', function () {
  let user1: UserModelDocument;
  let user2: UserModelDocument;
  // here we create the users
  beforeEach(async function () {
    user1 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'user1@test.com',
      username: 'username1',
      password: 'password123',
      provider: 'local',
    });
    user2 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'user2@test.com',
      username: 'username2',
      password: 'password123',
      provider: 'local',
    });
    // save those users to mongoDB
    await user1.save();
    await user2.save();
  });
  afterEach(function () {
    sinon.restore();
    return utils.clearDatabase();
  });
  describe('save', function () {
    it('does not log expected disabled influx errors', function (done) {
      const originalEnabled = config.influxdb.enabled;
      const originalNodeEnv = process.env.NODE_ENV;
      const log = sinon.stub(winston.Logger.prototype, 'log');
      const service = statsService;
      config.influxdb.enabled = false;
      process.env.NODE_ENV = 'development';
      service.save(new Message(), function (err) {
        try {
          if (!err) throw new Error('Expected InfluxDB to be disabled');
          err.should.be.an.Error();
          err.message.should.match(/InfluxDB disabled/);
          sinon.assert.notCalled(log);
          done();
        } catch (error) {
          done(error);
        } finally {
          config.influxdb.enabled = originalEnabled;
          process.env.NODE_ENV = originalNodeEnv;
        }
      });
    });
  });
  describe('process errors', function () {
    it('returns an error when the first message cannot be found', function (done) {
      const fakeQuery = {
        sort: () => ({
          exec: () => Promise.resolve(null),
        }),
      };
      sinon
        .stub(Message, 'findOne')
        .returns(fakeQuery as unknown as ReturnType<typeof Message.findOne>);
      const message = new Message({
        userFrom: user1._id,
        userTo: user2._id,
        content: 'orphan reply',
      });
      statsService.process(message, function (err) {
        if (!err)
          return done(new Error('Expected the missing first message to fail'));
        err.should.be.an.Error();
        err.message.should.match(/first message not found/);
        done();
      });
    });
  });
  describe('Testing messageToStatsService.process(message)', function () {
    // here we create some example messages
    let message1to2: MessageDocument;
    let message2to1: MessageDocument;
    let shortMessage: MessageDocument;
    let longMessage: MessageDocument;
    beforeEach(async function () {
      // creating content for short & long message
      const shortMsgContent = _.repeat('.', longMessageMinimumLength - 1);
      const longMsgContent = _.repeat('.', longMessageMinimumLength);
      const delay = () => new Promise<void>(resolve => setTimeout(resolve, 2));
      // Preserve the sequential timestamps used by the original waterfall.
      await delay();
      message1to2 = new Message({
        userFrom: user1._id,
        userTo: user2._id,
        content: 'message content',
      });
      await delay();
      message2to1 = new Message({
        userFrom: user2._id,
        userTo: user1._id,
        content: 'message content',
      });
      await delay();
      shortMessage = new Message({
        userFrom: user1._id,
        userTo: user2._id,
        content: shortMsgContent,
      });
      await delay();
      longMessage = new Message({
        userFrom: user2._id,
        userTo: user1._id,
        content: longMsgContent,
      });
      for (const message of [
        message1to2,
        message2to1,
        shortMessage,
        longMessage,
      ]) {
        await message.save();
      }
    });
    it('[first reply] should give tag with key `position` and value `firstReply`', function (done) {
      statsService.process(message2to1, function (err, stat) {
        if (err) return done(err);
        try {
          stat.should.have.propertyByPath('tags', 'position').eql('firstReply');
          return done();
        } catch (e) {
          return done(e);
        }
      });
    });
    it('[short message] stat should contain tag "messageLengthType": "long"', function (done) {
      statsService.process(longMessage, function (err, stat) {
        if (err) return done(err);
        try {
          stat.should.have
            .propertyByPath('tags', 'messageLengthType')
            .eql('long');
          return done();
        } catch (err) {
          return done(err);
        }
      });
    });
  });
});
