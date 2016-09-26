'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    path = require('path'),
    async = require('async'),
    User = mongoose.model('User'),
    Message = mongoose.model('Message'),
    messageToInfluxService =
  require(path.resolve('./modules/messages/server/services/message-to-influx.server.service'));
require('should');

/**
 * Unit tests
 */
describe('Message to influx server service Unit Tests:', function() {
  var user1,
      user2;

  // here we create the users
  beforeEach(function(done) {

    user1 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'user1@test.com',
      username: 'username1',
      password: 'password123',
      provider: 'local'
    });

    user2 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'user2@test.com',
      username: 'username2',
      password: 'password123',
      provider: 'local'
    });

    // save those users to mongoDB
    user1.save(function(err) {
      if (err) done(err);
      user2.save(function(err) {
        if (err) done(err);
        done();
      });
    });
  });

  // after each test removing all the messages and users
  afterEach(function(done) {
    Message.remove().exec(function() {
      User.remove().exec(done);
    });
  });

  describe('Testing messageToInfluxService.process(message)', function () {
    // here we create some example messages
    var message1to2,
        message2to1,
        shortMessage,
        longMessage;

    beforeEach(function (done) {
      // defining some messages which will be later used for testing
      message1to2 = new Message({
        userFrom: user1._id,
        userTo: user2._id,
        content: 'message content'
      });
      message2to1 = new Message({
        userFrom: user2._id,
        userTo: user1._id,
        content: 'message content'
      });
      shortMessage = new Message({
        userFrom: user1._id,
        userTo: user2._id,
        content: 'short content'
      });
      // setting a long message
      var longString = '0123456789';
      for (var i = 0; i < 5; ++i) {
        var output = longString + longString;
        longString = output;
      }
      longMessage = new Message({
        userFrom: user2._id,
        userTo: user1._id,
        content: longString
      });

      // save the messages to mongoDB
      async.eachSeries([message1to2, message2to1, shortMessage, longMessage],
        function (msg, callback) {
          // make sure messages will be created with some time difference
          setTimeout(function () {
            msg.save(callback);
          }, 2);
        }, done);
    });


    it('[first message] should give tag with key `position` and value `first`',
      function (done) {
        messageToInfluxService.process(message1to2, function (err, fields, tags) {
          if (err) return done(err);
          try {
            tags.should.have.property('position', 'first');
            return done();
          } catch (err) {
            return done(err);
          }
        });
      });

    it('[first reply] should give tag with key `position` and value `first_reply`',
      function (done) {
        messageToInfluxService.process(message2to1, function (err, fields, tags) {
          if (err) return done(err);
          try {
            tags.should.have.property('position', 'first_reply');
            return done();
          } catch (e) {
            return done(e);
          }
        });
      });

    it('[first reply] should give field with key `replyTime` >= 0',
      function (done) {
        messageToInfluxService.process(message2to1, function (err, fields) {
          if (err) return done(err);
          try {
            fields.should.have.property('replyTime');
            (fields.replyTime >= 0).should.be.exactly(true);
            return done();
          } catch (err) {
            return done(err);
          }
        });
      });

    it('[not first position nor first reply] should give tag with key `position` and value `first_reply`',
      function (done) {
        messageToInfluxService.process(shortMessage, function (err, fields, tags) {
          if (err) return done(err);
          try {
            tags.should.have.property('position', 'other');
            return done();
          } catch (err) {
            return done(err);
          }
        });
      });

    it('[short message] should give tag with key `msgLength` and value `short`',
      function (done) {
        messageToInfluxService.process(shortMessage, function (err, fields, tags) {
          if (err) return done(err);
          try {
            tags.should.have.property('msgLengthType', 'short');
            return done();
          } catch (err) {
            return done(err);
          }
        });
      });

    it('[short message] should give tag with key `msgLength` and value `long`',
      function (done) {
        messageToInfluxService.process(longMessage, function (err, fields, tags) {
          if (err) return done(err);
          try {
            tags.should.have.property('msgLengthType', 'long');
            return done();
          } catch (err) {
            return done(err);
          }
        });
      });

    it('[not-first-reply message] should give field with key `replyTime` and value -1',
      function (done) {
        messageToInfluxService.process(longMessage, function (err, fields) {
          if (err) return done(err);
          try {
            fields.should.have.property('replyTime', -1);
            return done();
          } catch (err) {
            return done(err);
          }
        });
      });

    it('[every message] should give field with key `msgLength` and correct length as value',
      function (done) {
        messageToInfluxService.process(message1to2, function (err, fields) {
          if (err) return done(err);
          try {
            fields.should.have.property('msgLength', message1to2.content.length);
            return done();
          } catch (err) {
            return done(err);
          }
        });
      });

    it('[every message] should give field with key `time` which is timestamp (integer) in specific range',
      function (done) {
        messageToInfluxService.process(message1to2, function (err, fields) {
          if (err) return done(err);
          try {
            fields.should.have.property('time');
            (typeof fields.time).should.be.exactly('number');
            // here we test wheter the number is between now and some not so
            // past time
            (fields.time > 1400000000 * 1000).should.be.exactly(true);
            (fields.time <= Date.now()).should.be.exactly(true);
            return done();
          } catch (err) {
            return done(err);
          }
        });
      });
  });
});
