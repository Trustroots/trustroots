'use strict';

var mongoose = require('mongoose'),
    should = require('should'),
    path = require('path'),
    _ = require('lodash'),
    sinon = require('sinon'),
    config = require(path.resolve('./config/config')),
    User = mongoose.model('User'),
    EventEmitter = require('events'),
    Message = mongoose.model('Message'),
    messageStatService = require(path.resolve(
      './modules/messages/server/services/message-stat.server.service')),
    messageController = require(path.resolve(
      './modules/messages/server/controllers/messages.server.controller'));

describe('Integration of the MessageStat service', function () {
  // stubbing the updateMessageStat
  var reachEventEmitter;

  before(function () {
    // this emitter will listen to reaching the updateMessageStat service
    reachEventEmitter = new EventEmitter();
  });

  beforeEach(function () {
    // stub the updateMessageStat to emit an event which we could catch in a test
    sinon.stub(messageStatService, 'updateMessageStat').callsFake(function () {
      reachEventEmitter.emit('reachedUpdateMessageStat', arguments);
    });
  });

  // reverting the stubbing of updateMessageStat
  afterEach(function () {
    sinon.restore();
  });

  // creating some users before each test
  var user1,
      user2;

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
      description: _.repeat('.', config.profileMinimumLength)
    });

    user2 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'user2@test.com',
      username: 'username2',
      password: 'password123',
      provider: 'local',
      public: true
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

  // after each test removing all the messages and users (cleaning the database)
  afterEach(function (done) {
    Message.deleteMany().exec(function () {
      User.deleteMany().exec(done);
    });
  });


  it('should reach the service with correct data when sending a new message',
    function (done) {

      // we're stubbing the express.response here
      function Res() {}
      Res.prototype.status = function (statusCode) { // eslint-disable-line no-unused-vars
        // this.statusCode = statusCode; // use for debug
        return this;
      };
      // we could do something on response, but we don't care
      Res.prototype.send = function (response) { // eslint-disable-line no-unused-vars
        // console.log(this.statusCode, response); // use for debug
      };
      Res.prototype.json = Res.prototype.send;

      var req = {
        user: {
          _id: user1._id
        },
        body: {
          userTo: String(user2._id),
          content: _.repeat('.', config.limits.longMessageMinimumLength - 1)
        }
      };

      var res = new Res();

      // sending the message via controller
      messageController.send(req, res);

      // check that updateMessageStat was reached with the expected data
      reachEventEmitter.once('reachedUpdateMessageStat', function (args) {
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
      });
    });
});
