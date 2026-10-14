import type {
  MessageDocument,
  MessageModel,
  MessageRecord,
  TestConfigModule,
  UserDocument,
} from '../../../../testutils/server/model-contracts.mts';
const mongoose: typeof import('mongoose') = require('mongoose');
const should: typeof import('should') = require('should');
const _: typeof import('lodash') = require('lodash');
const sinon: typeof import('sinon') = require('sinon');
const config: TestConfigModule = require('./../../../../config/config.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil') = require('../../../../testutils/server/data.server.testutil');
const messageStatService: typeof import('./../../server/services/message-stat.server.service.mjs') = require('./../../server/services/message-stat.server.service.mjs');
const messageController: typeof import('./../../server/controllers/messages.server.controller.mjs') = require('./../../server/controllers/messages.server.controller.mjs');

const EventEmitter: typeof import('events').EventEmitter =
  require('events').EventEmitter;
const Message = mongoose.model<MessageRecord, MessageModel>('Message');
type StatUpdateArgs = [MessageDocument, ...unknown[]];

describe('Integration of the MessageStat service', function () {
  // stubbing the updateMessageStat
  let reachEventEmitter: InstanceType<typeof EventEmitter>;

  before(function () {
    // this emitter will listen to reaching the updateMessageStat service
    reachEventEmitter = new EventEmitter();
  });

  beforeEach(function () {
    // stub the updateMessageStat to emit an event which we could catch in a test
    sinon.stub(messageStatService, 'updateMessageStat').callsFake(function (
      ...args
    ) {
      reachEventEmitter.emit('reachedUpdateMessageStat', args);
    });
  });

  // reverting the stubbing of updateMessageStat
  afterEach(function () {
    sinon.restore();
  });

  // creating some users before each test
  let user1: UserDocument;
  let user2: UserDocument;

  beforeEach(function (done) {
    user1 = utils.createTestUser({
      email: 'user1@test.com',
      username: 'username1',
      password: 'password123',
      description: _.repeat('.', config.profileMinimumLength),
    });

    user2 = utils.createTestUser({
      email: 'user2@test.com',
      username: 'username2',
      password: 'password123',
    });

    // save those users to mongoDB
    user1.save(function (err) {
      if (err) return done(err);
      user2.save(function (err) {
        if (err) return done(err);
        done();
      });
    });
  });

  afterEach(utils.clearDatabase);

  it('should reach the service with correct data when sending a new message', function (done) {
    // we're stubbing the express.response here
    class Res {
      status(statusCode: number): this {
        // this.statusCode = statusCode; // use for debug
        void statusCode;
        return this;
      }

      // We could do something on response, but we don't care.
      send(response: unknown): void {
        // console.log(this.statusCode, response); // use for debug
        void response;
      }

      json(response: unknown): void {
        this.send(response);
      }
    }

    const req = {
      user: {
        _id: user1._id,
        roles: ['user'],
      },
      body: {
        userTo: String(user2._id),
        content: _.repeat('.', config.limits.longMessageMinimumLength - 1),
      },
    };

    const res = new Res();

    // sending the message via controller
    messageController.send(req, res);

    // check that updateMessageStat was reached with the expected data
    reachEventEmitter.once(
      'reachedUpdateMessageStat',
      function (args: StatUpdateArgs) {
        args[0].should.have.property('userFrom', user1._id);
        args[0].should.have.property('userTo', user2._id);
        args[0].should.have.property('_id');

        // check that the message is already saved to database
        // at the time of updating stats
        Message.findById(args[0]._id).exec(function (err, msg) {
          if (err) return done(err);
          try {
            should(msg).not.equal(null);
            should(msg).have.property('userFrom', user1._id);
            return done();
          } catch (e) {
            if (e) return done(e);
          }
        });
      },
    );
  });
});
