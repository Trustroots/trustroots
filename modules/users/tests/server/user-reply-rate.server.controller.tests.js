'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    path = require('path'),
    _ = require('lodash'),
    async = require('async'),
    User = mongoose.model('User'),
    Message = mongoose.model('Message'),
    replyRateModule =
  require(path.resolve('./modules/users/server/controllers/user-reply-rate.server.controller'));
require('should');

/**
 * Unit tests
 */
describe('Reply Rate and Time Unit Test', function () {

  // here we create the users
  var users = [];
  var userData = function (no) {
    return {
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'user' + no + '@test.com',
      username: 'username' + no,
      password: 'password123',
      provider: 'local'
    };
  };
  beforeEach(function(done) {
    async.eachSeries([0, 1, 2, 3, 4, 5, 6, 7],
      function (userNo, callback) {
        var user = new User(userData(userNo));
        users.push(user);
        user.save(callback);
      }, done);
  });

  // here we create some messages
  var day = 24 * 3600 * 1000;
  // messageData - array of messages: [userFromNo, userToNo, created]
  var messageDataStubs = [
    // general testing
    [1, 0, new Date(Date.now() - 5 * day)],
    [0, 1, new Date(Date.now() - 4 * day)],
    [0, 1, new Date(Date.now() - 3.1 * day)],
    [1, 0, new Date(Date.now() - 3 * day)],
    [2, 0, new Date(Date.now() - 4 * day)],
    [0, 2, new Date(Date.now() - 2 * day)],
    [3, 0, new Date(Date.now() - 4 * day)],
    [0, 3, new Date(Date.now() - 1 * day)],
    [4, 0, new Date(Date.now() - 2 * day)],
    // testing ignoring old threads
    [2, 1, new Date(Date.now() - 179 * day)],
    [1, 2, new Date(Date.now() - 10 * day)],
    [3, 1, new Date(Date.now() - 181 * day)],
    [1, 3, new Date(Date.now() - 1 * day)],
    [4, 1, new Date(Date.now() - 179 * day)],
    [5, 1, new Date(Date.now() - 181 * day)],
    // testing ignoring threads started by user
    [2, 3, new Date(Date.now() - 3 * day)],
    [3, 2, new Date(Date.now() - 2 * day)],
    [4, 2, new Date(Date.now() - 4 * day)],
    [2, 4, new Date(Date.now() - 3 * day)],
    [2, 5, new Date(Date.now() - 2 * day)],
    // user 6 didn't receive anything
    // user 7 doesn't respond anything
    [6, 7, new Date(Date.now() - 1 * day)]
  ];
  var messageData = function (stub) {
    return {
      userFrom: users[stub[0]]._id,
      userTo: users[stub[1]]._id,
      content: _.repeat('.', 50),
      created: stub[2] || new Date()
    };
  };
  beforeEach(function (done) {
    // saving the messages to mongoDB
    async.eachSeries(messageDataStubs,
      function (messageStub, callback) {
        var message = new Message(messageData(messageStub));
        message.save(callback);
      }, done);
  });

  // after each test removing all the messages and users
  afterEach(function(done) {
    Message.remove().exec(function() {
      User.remove().exec(done);
    });
  });

  it('should return amount of replied and unreplied threads of user',
    function (done) {
      replyRateModule.readFromDatabase(users[0]._id, function (err, resp) {
        if (err) return done(err);
        try {
          resp.should.have.property('replied', 3);
          resp.should.have.property('notReplied', 1);
          return done();
        } catch (e) {
          return done(e);
        }
      });
    });

  it('should return average replyTime of replied threads by user',
    function (done) {
      replyRateModule.readFromDatabase(users[0]._id, function (err, resp) {
        if (err) return done(err);
        try {
          resp.should.have.property('replyTime');
          (resp.replyTime).should.be.approximately(2 * day, 10);
          return done();
        } catch (e) {
          return done(e);
        }
      });
    });

  it('should ignore threads started more than 180 days ago',
    function (done) {
      replyRateModule.readFromDatabase(users[1]._id, function (err, resp) {
        if (err) return done(err);
        try {
          resp.should.have.property('replied', 1);
          resp.should.have.property('notReplied', 1);
          return done();
        } catch (e) {
          return done(e);
        }
      });
    });

  it('should ignore threads started by the user',
    function (done) {
      replyRateModule.readFromDatabase(users[2]._id, function (err, resp) {
        if (err) return done(err);
        try {
          resp.should.have.property('replied', 1);
          resp.should.have.property('notReplied', 0);
          return done();
        } catch (e) {
          return done(e);
        }
      });
    });

  context('no new-enough threads to the user started', function () {
    it('should show 0 replied and not replied',
      function (done) {
        replyRateModule.readFromDatabase(users[6]._id, function (err, resp) {
          if (err) return done(err);
          try {
            resp.should.have.property('replied', 0);
            resp.should.have.property('notReplied', 0);
            return done();
          } catch (e) {
            return done(e);
          }
        });
      });

    it('should show null reply time',
      function (done) {
        replyRateModule.readFromDatabase(users[6]._id, function (err, resp) {
          if (err) return done(err);
          try {
            resp.should.have.property('replyTime', null);
            return done();
          } catch (e) {
            return done(e);
          }
        });
      });
  });

  context('some threads to user started and user replied none', function () {
    it('should show 0 replied and some not replied',
      function (done) {
        replyRateModule.readFromDatabase(users[7]._id, function (err, resp) {
          if (err) return done(err);
          try {
            resp.should.have.property('replied', 0);
            resp.should.have.property('notReplied', 1);
            return done();
          } catch (e) {
            return done(e);
          }
        });
      });
    it('should show null reply time',
      function (done) {
        replyRateModule.readFromDatabase(users[7]._id, function (err, resp) {
          if (err) return done(err);
          try {
            resp.should.have.property('replyTime', null);
            return done();
          } catch (e) {
            return done(e);
          }
        });
      });
  });
});
