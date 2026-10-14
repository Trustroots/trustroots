import type {
  TestConfigModule,
  UserDocument,
} from '../../../../testutils/server/model-contracts.mts';
const should: typeof import('should') = require('should');
const _: typeof import('lodash') = require('lodash');
const sinon: typeof import('sinon') = require('sinon');
const config: TestConfigModule = require('./../../../../config/config.mts');
const EventEmitter: typeof import('events') = require('events');
const influx: typeof import('influx') = require('influx');
const messageController: typeof import('./../../server/controllers/messages.server.controller.mjs') = require('./../../server/controllers/messages.server.controller.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil') = require('../../../../testutils/server/data.server.testutil');
describe('Message to Stats API server service Integration Test', function () {
  let reachEventEmitter: import('node:events').EventEmitter;
  before(function () {
    // this emitter will emit event 'reachedInfluxdb' with variables measurement,
    // fields, tags when the influxdb stub is reached
    reachEventEmitter = new EventEmitter();
  });
  beforeEach(function () {
    // it will emit an event 'reachedInfluxdb' which should be caught in the tests
    sinon
      .stub(influx.InfluxDB.prototype, 'writeMeasurement')
      .callsFake(function (measurement, fields, tags) {
        return new Promise(function (resolve) {
          reachEventEmitter.emit('reachedInfluxdb', measurement, fields, tags);
          resolve();
        });
      });
  });
  // back to the original
  afterEach(function () {
    sinon.restore();
  });
  let user1: UserDocument;
  let user2: UserDocument;
  // here we create the users before each test
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
    user1
      .save()
      .then(() => {
        user2
          .save()
          .then(() => {
            done();
          })
          .catch(done);
      })
      .catch(done);
  });
  afterEach(utils.clearDatabase);
  context('when a new message is sent', function () {
    // send the new message, do it synchronously
    // otherwise the event may be too early and miss the tests
    // there should be no asynchronous beforeEach after this
    // the tests themselves will wait for the event of reaching influxdb
    beforeEach(function () {
      // we're stubbing the express.response here
      // (not sure if i use the mocking/stubbing terminology right)
      class Res {
        status(_statusCode: number): this {
          void _statusCode;
          return this;
        }
        send(_response: unknown): void {
          void _response;
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
    });
    context('when influxdb is enabled', function () {
      // stubbing the influxdb config
      beforeEach(function () {
        sinon.stub(config.influxdb, 'enabled').value(true);
        sinon.stub(config.influxdb, 'options').value({
          host: 'localhost',
          port: 4242,
          protocol: 'http',
          database: 'will-never-be-reached',
        });
      });
      it('the data should reach the database', function (done) {
        // we want to call the listener when the influxdb is reached
        // that means the test passed
        reachEventEmitter.once('reachedInfluxdb', function () {
          return done();
        });
        // otherwise the test will fail with timeout
      });
      it('the data should have a proper format', function (done) {
        // we want to call the listener only once
        reachEventEmitter.once(
          'reachedInfluxdb',
          function (
            measurement: string,
            points: Array<{
              fields: Record<string, string | number>;
              tags: Record<string, string | number>;
            }>,
          ) {
            try {
              measurement.should.equal('messageSent');
              points.length.should.equal(1);
              should.exist(points[0].fields);
              should.exist(points[0].tags);
              points[0].fields.should.have.property('messageLength');
              points[0].tags.should.have.property('messageLengthType');
              points[0].tags.should.have.property('position', 'first');
              return done();
            } catch (e) {
              return done(e);
            }
          },
        );
      });
    });
    context('when influxdb is disabled', function () {
      // @TODO possibly test with sinon
      // we don't see any way to test this
      // it('saving data to statistics should be silently ignored');
    });
  });
});
