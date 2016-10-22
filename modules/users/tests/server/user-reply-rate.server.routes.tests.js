'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    request = require('supertest'),
    path = require('path'),
    _ = require('lodash'),
    async = require('async');
require('should');

var replyRateController =
  require(path.resolve('./modules/users/server/controllers/user-reply-rate.server.controller')),
    User = mongoose.model('User'),
    Message = mongoose.model('Message'),
    testutils = require(path.resolve('./testutils')),
    express = require(path.resolve('./config/lib/express'));

/**
 * User reply rate test
 */
describe('User Reply Rate Tests', function () {
  var app,
      agent,
      jobs = testutils.catchJobs();

  before(function () {
    // Get application
    app = express.init(mongoose);
    agent = request.agent(app);
  });

  // Before every test we create new users
  var users = [];
  var userData = function (no) {
    return {
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'user' + no + '@test.com',
      username: 'username' + no,
      password: 'password123',
      provider: 'local',
      description: _.repeat('.', 200),
      public: true
    };
  };

  beforeEach(function(done) {
    users = [];
    async.eachSeries(_.range(10),
      function (userNo, callback) {
        var user = new User(userData(userNo));
        users.push(user);
        user.save(callback);
      }, done);
  });

  // Before every test we create some messages
  var day = 24 * 3600 * 1000;
  // messageData - array of messages: [userFromNo, userToNo, created]
  var messageDataStubs = [
    // general testing
    // now replyRate of user0 is 63% and replyTime is 7 days
    // and medianReplyRate is 4 days
    // when user0 will reply to message 3->0
    // replyRate will be 75% and replyTime 6 days.
    [1, 0, new Date(Date.now() - 27 * day)],
    [0, 1, new Date(Date.now() - 4 * day)], // in 23 days
    [0, 1, new Date(Date.now() - 3.1 * day)],
    [1, 0, new Date(Date.now() - 3 * day)],
    [2, 0, new Date(Date.now() - 5 * day)],
    [0, 2, new Date(Date.now() - 2 * day)], // in 3 days
    [3, 0, new Date(Date.now() - 4 * day)], // not replied
    [4, 0, new Date(Date.now() - 2 * day)], // not replied
    [5, 0, new Date(Date.now() - 6 * day)],
    [0, 5, new Date(Date.now() - 2 * day)], // in 4 days
    [6, 0, new Date(Date.now() - 5 * day)],
    [0, 6, new Date(Date.now() - 1 * day)], // in 4 days
    [7, 0, new Date(Date.now() - 3 * day)],
    [0, 7, new Date(Date.now() - 2 * day)], // in 1 days
    [8, 0, new Date(Date.now() - 7 * day)] // not replied
  ];

  var messageData = function (stub) {
    return {
      userFrom: users[stub[0]]._id,
      userTo: users[stub[1]]._id,
      content: _.repeat('.', 50), // deeply meaningful message text
      created: stub[2] || new Date()
    };
  };

  // Save the messages to database
  beforeEach(function (done) {
    async.eachSeries(messageDataStubs,
      function (messageStub, callback) {
        var message = new Message(messageData(messageStub));
        message.save(callback);
      }, done);
  });

  // Initialize the user0's reply rate
  beforeEach(function (done) {
    replyRateController.updateUserReplyRate(users[0]._id, done);
  });


  // After each test removing all the messages and users
  afterEach(function(done) {
    Message.remove().exec(function() {
      User.remove().exec(done);
    });
  });

  context('signed in', function () {
    // Sign in
    beforeEach(function (done) {
      agent.post('/api/auth/signin')
        .send(_.pick(userData(0), ['username', 'password']))
        .expect(200)
        .end(function (err) {
          if (err) return done(err);
          return done();
        });
    });

    // Sign out
    afterEach(function (done) {
      agent.get('/api/auth/signout')
        .expect(302)
        .end(function (err) {
          if (err) return done(err);
          return done();
        });
    });

    it('should show replyRate, replyTime and medianReplyTime in user profile',
      function (done) {
        agent.get('/api/users/' + users[0].username)
          .expect(200)
          .end(function (err, resp) {
            if (err) return done(err);
            try {
              var response = resp.body;

              response.should.have.property('replyRate', '63%');
              response.should.have.property('replyTime', '1 week');
              response.should.have.property('medianReplyTime', '4 days');

              return done();
            } catch (e) {
              if (e) return done(e);
            }
          });
      });

    it('should update receiver\'s reply stats when `first` message',
      function (done) {
        // Send a new message (first in a thread)
        agent.post('/api/messages')
          .send({ content: 'hello there', userTo: users[9]._id.toString() })
          .expect(200)
          .end(function (err) {
            if (err) return done(err);
            try {
              // Check that agenda was given a correct job
              jobs.length.should.equal(1);
              jobs[0].should.have.property('type', 'update reply rate');
              jobs[0].should.have.property('data', {
                userId: users[9]._id.toString()
              });
              return done();
            } catch (e) {
              return done(e);
            }
          });
      });

    it('should update sender\'s reply stats when `firstReply` message',
      function (done) {
        // Send a new message (first reply)
        agent.post('/api/messages')
          .send({ content: 'hello there', userTo: users[3]._id.toString() })
          .expect(200)
          .end(function (err) {
            if (err) return done(err);
            try {
              // Check that agenda was given a correct job
              jobs.length.should.equal(1);
              jobs[0].should.have.property('type', 'update reply rate');
              jobs[0].should.have.property('data', {
                userId: users[0]._id.toString()
              });
              return done();
            } catch (e) {
              return done(e);
            }
          });
      });
  });
});
