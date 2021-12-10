const mongoose = require('mongoose');
const should = require('should');
const path = require('path');
const _ = require('lodash');
const sinon = require('sinon');
const config = require(path.resolve('./config/config'));
const EventEmitter = require('events');
const influx = require('influx');
const Promise = require('promise');
const messageController = require(path.resolve(
  './modules/messages/server/controllers/messages.server.controller',
));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

const User = mongoose.model('User');

describe('Message to Stats API server service Integration Test', function () {
  let reachEventEmitter;

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

  let user1;
  let user2;

  // here we create the users before each test
  beforeEach(function (done) {
    user1 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'user1@test.com',
      username: 'username1',
      password: 'password123',
      provider: 'local',
      public: true,
      roles: ['user'],
      description: _.repeat('.', config.profileMinimumLength),
    });

    user2 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'user2@test.com',
      username: 'username2',
      password: 'password123',
      provider: 'local',
      public: true,
      roles: ['user'],
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

  context('when a new message is sent', function () {
    // send the new message, do it synchronously
    // otherwise the event may be too early and miss the tests
    // there should be no asynchronous beforeEach after this
    // the tests themselves will wait for the event of reaching influxdb
    beforeEach(function () {
      // we're stubbing the express.response here
      // (not sure if i use the mocking/stubbing terminology right)
      function Res() {}
      // eslint-disable-next-line no-unused-vars
      Res.prototype.status = function (statusCode) {
        // this.statusCode = statusCode; // use for debug
        return this;
      };
      // we could do something on response, but we don't care
      // eslint-disable-next-line no-unused-vars
      Res.prototype.send = function (response) {
        // console.log(this.statusCode, response); // use for debug
      };
      Res.prototype.json = Res.prototype.send;

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
          function (measurement, points) {
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
