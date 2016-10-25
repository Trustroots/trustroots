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
    messageController = require(path.resolve(
      './modules/messages/server/controllers/messages.server.controller'));


require('should');

describe('function messageController.positionInThread', function () {

  // Before every test we create 2 users
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
    async.eachSeries([0, 1],
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

  // Reusables in different Contexts
  // reused function to create messages
  function messageData(stub) {
    return {
      userFrom: users[stub[0]]._id,
      userTo: users[stub[1]]._id,
      content: _.repeat('.', 50),
      created: stub[2] || new Date()
    };
  }
  // a day in milliseconds
  var day = 24 * 3600 * 1000;

  context('only one way messages', function () {
    var messages;

    // here we create some messages
    // messageData - array of messages: [userFromNo, userToNo, created]
    var messageDataStubs = [
      [0, 1, new Date(Date.now() - 3 * day)],
      [0, 1, new Date(Date.now() - 2 * day)],
      [0, 1, new Date(Date.now() - 1 * day)]
    ];

    beforeEach(function (done) {
      messages = [];
      // saving the messages to mongoDB
      async.eachSeries(messageDataStubs,
        function (messageStub, callback) {
          var message = new Message(messageData(messageStub));
          messages.push(message);
          message.save(callback);
        }, done);
    });

    it('[first message] should say `first`', function (done) {
      messageController.positionInThread(messages[0], function (err, resp) {
        if (err) return done(err);

        try {
          resp.should.equal('first');
          return done();
        } catch (e) {
          return done(e);
        }
      });
    });

    it('[other message] should say `other`', function (done) {
      messageController.positionInThread(messages[2], function (err, resp) {
        if (err) return done(err);

        try {
          resp.should.equal('other');
          return done();
        } catch (e) {
          return done(e);
        }
      });
    });
  });

  context('both way messages', function () {
    var messages;

    // here we create some messages
    // messageData - array of messages: [userFromNo, userToNo, created]
    var messageDataStubs = [
      [0, 1, new Date(Date.now() - 3 * day)],
      [0, 1, new Date(Date.now() - 2 * day)],
      [1, 0, new Date(Date.now() - 1 * day)],
      [1, 0, new Date(Date.now() - 0.5 * day)]
    ];

    beforeEach(function (done) {
      messages = [];
      // saving the messages to mongoDB
      async.eachSeries(messageDataStubs,
        function (messageStub, callback) {
          var message = new Message(messageData(messageStub));
          messages.push(message);
          message.save(callback);
        }, done);
    });

    it('[first message] should say `first`', function (done) {
      messageController.positionInThread(messages[0], function (err, resp) {
        if (err) return done(err);

        try {
          resp.should.equal('first');
          return done();
        } catch (e) {
          return done(e);
        }
      });
    });

    it('[first reply] should say `firstReply`', function (done) {
      messageController.positionInThread(messages[2], function (err, resp, replyTime) {
        if (err) return done(err);

        try {
          resp.should.equal('firstReply');
          replyTime.should.be.approximately(2 * day, 1000);
          return done();
        } catch (e) {
          return done(e);
        }
      });
    });

    it('[other message] should say `other`', function (done) {
      messageController.positionInThread(messages[3], function (err, resp) {
        if (err) return done(err);

        try {
          resp.should.equal('other');
          return done();
        } catch (e) {
          return done(e);
        }
      });
    });
  });
});
