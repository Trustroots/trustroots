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

  // Before every test we create 8 users username0 - username7
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
    users = [];
    async.eachSeries([0, 1, 2, 3, 4, 5, 6, 7],
      function (userNo, callback) {
        var user = new User(userData(userNo));
        users.push(user);
        user.save(callback);
      }, done);
  });

  // After each test removing all the messages and users
  afterEach(function(done) {
    Message.remove().exec(function() {
      User.remove().exec(done);
    });
  });

  describe('replyRateModule.readFromDatabase', function () {

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

    var oldestMessageCreated = messageDataStubs[0][2];

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

    it('should return creation time of the oldest thread (counting expire date)',
      function (done) {
        replyRateModule.readFromDatabase(users[0]._id, function (err, resp) {
          if (err) return done(err);
          try {
            resp.should.have.property('oldest', oldestMessageCreated);
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

  describe('replyRateModule.updateUserReplyRate', function () {
    // here we create some messages
    var day = 24 * 3600 * 1000;
    // messageData - array of messages: [userFromNo, userToNo, created]
    var messageDataStubs = [
      [1, 0, new Date(Date.now() - 5 * day)],
      [0, 1, new Date(Date.now() - 4 * day)],
      [0, 1, new Date(Date.now() - 3.1 * day)],
      [1, 0, new Date(Date.now() - 3 * day)],
      [2, 0, new Date(Date.now() - 4 * day)],
      [0, 2, new Date(Date.now() - 2 * day)],
      [3, 0, new Date(Date.now() - 4 * day)],
      [0, 3, new Date(Date.now() - 1 * day)],
      [4, 0, new Date(Date.now() - 2 * day)],
      // testing old message
      [5, 1, new Date(Date.now() - 179.5 * day)],
      [1, 5, new Date(Date.now() - 4 * day)],
      [1, 5, new Date(Date.now() - 3.1 * day)],
      [5, 1, new Date(Date.now() - 3 * day)],
      [6, 1, new Date(Date.now() - 4 * day)],
      [1, 6, new Date(Date.now() - 2 * day)]
    ];

    var oldestMessageCreated = messageDataStubs[0][2];

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

    it('should return user profile with replyRate, replyTime, replyExpire',
      function (done) {
        replyRateModule.updateUserReplyRate(users[0]._id, function (err, resp) {
          if (err) return done(err);
          try {
            resp.should.have.property('replyRate', 0.75);
            resp.should.have.property('replyTime');
            (resp.replyTime).should.be.approximately(2 * day, 10);
            resp.should.have.property('replyExpire',
              new Date(oldestMessageCreated.getTime() + 180 * day));
            return done();
          } catch (e) {
            return done(e);
          }
        });
      });

    it('[old] should return replyExpire 1 day from now',
      function (done) {
        replyRateModule.updateUserReplyRate(users[1]._id, function (err, resp) {
          if (err) return done(err);
          try {
            resp.should.have.property('replyExpire');
            (resp.replyExpire.getTime()).should.be
              .approximately(Date.now() + day, 2000);
            return done();
          } catch (e) {
            return done(e);
          }
        });
      });
  });

  describe('replyRateModule.updateExpiredReplyRates', function () {
    // here we add users with expired profiles
    var expiredUsers = [];
    var userData = function (no) {
      return {
        firstName: 'Full',
        lastName: 'Name',
        displayName: 'Full Name',
        email: 'user' + no + '@test.com',
        username: 'username' + no,
        password: 'password123',
        provider: 'local',
        replyExpire: new Date(Date.now() - 1)
      };
    };

    beforeEach(function(done) {
      expiredUsers = [];
      async.eachSeries([8, 9, 10],
        function (userNo, callback) {
          var user = new User(userData(userNo));
          expiredUsers.push(user);
          user.save(callback);
        }, done);
    });
    // here we create some messages
    var day = 24 * 3600 * 1000;
    // messageData - array of messages: [userFromNo, userToNo, created]
    var messageDataStubs = [
      [1, 0, new Date(Date.now() - 5 * day)],
      [0, 1, new Date(Date.now() - 4 * day)],
      [0, 1, new Date(Date.now() - 3.1 * day)],
      [1, 0, new Date(Date.now() - 3 * day)],
      [2, 0, new Date(Date.now() - 4 * day)]
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

    it('should update reply rates of 3 users',
      function (done) {
        replyRateModule.updateExpiredReplyRates(function (err, resp) {
          if (err) return done(err);
          try {
            resp.should.equal(expiredUsers.length);
            return done();
          } catch (e) {
            return done(e);
          }
        });
      });
  });

  describe('replyRateModule.display', function () {
    it('[reply rate] should return data as expected', function () {
      var output = replyRateModule.display({
        replyRate: 0.3371,
        replyTime: 7 * 24 * 3600 * 1000 + 7549
      });
      output.should.have.property('replyRate', '34%');
      output.should.have.property('replyTime', '1 week');
    });
  });
});
