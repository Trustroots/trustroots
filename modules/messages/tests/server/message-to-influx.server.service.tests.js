'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    path = require('path'),
    _ = require('lodash'),
    async = require('async'),
    config = require(path.resolve('./config/config')),
    User = mongoose.model('User'),
    Message = mongoose.model('Message'),
    messageToInfluxService =
  require(path.resolve('./modules/messages/server/services/message-to-influx.server.service'));
require('should');

// for testing length of long or short messages
var longMessageMinimumLength = config.limits.longMessageMinimumLength;

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
      if (err) return done(err);
      user2.save(done);
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
      // creating content for short & long message
      var shortMsgContent = _.repeat('.', longMessageMinimumLength - 1);
      var longMsgContent = _.repeat('.', longMessageMinimumLength);

      // defining some messages which will be later used for testing
      async.waterfall([

        // defining the messages with some time difference
        function (done) {
          setTimeout(function () {
            message1to2 = new Message({
              userFrom: user1._id,
              userTo: user2._id,
              content: 'message content'
            });
            done();
          }, 2);
        },

        function (done) {
          setTimeout(function () {
            message2to1 = new Message({
              userFrom: user2._id,
              userTo: user1._id,
              content: 'message content'
            });
            done();
          }, 2);
        },

        function (done) {
          setTimeout(function () {
            shortMessage = new Message({
              userFrom: user1._id,
              userTo: user2._id,
              content: shortMsgContent
            });
            done();
          }, 2);
        },

        function (done) {
          setTimeout(function () {
            longMessage = new Message({
              userFrom: user2._id,
              userTo: user1._id,
              content: longMsgContent
            });
            done();
          }, 2);
        },

        // saving the messages to mongoDB
        function (done) {
          async.eachSeries([message1to2, message2to1, shortMessage, longMessage],
            function (msg, callback) {
              msg.save(callback);
            }, done);
        }
      ], done);
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

    it('[first reply] should give tag with key `position` and value `firstReply`',
      function (done) {
        messageToInfluxService.process(message2to1, function (err, fields, tags) {
          if (err) return done(err);
          try {
            tags.should.have.property('position', 'firstReply');
            return done();
          } catch (e) {
            return done(e);
          }
        });
      });

    it('[first reply] should give field with key `replyTime` > 0',
      function (done) {
        messageToInfluxService.process(message2to1, function (err, fields) {
          if (err) return done(err);
          try {
            fields.should.have.property('replyTime');
            (fields.replyTime).should.be.above(0);
            return done();
          } catch (err) {
            return done(err);
          }
        });
      });

    it('[not first position nor first reply] should give tag with key `position` and value `other`',
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

    it('[short message] should give tag with key `messageLength` and value `short`',
      function (done) {
        messageToInfluxService.process(shortMessage, function (err, fields, tags) {
          if (err) return done(err);
          try {
            tags.should.have.property('messageLengthType', 'short');
            return done();
          } catch (err) {
            return done(err);
          }
        });
      });

    it('[short message] should give tag with key `messageLength` and value `long`',
      function (done) {
        messageToInfluxService.process(longMessage, function (err, fields, tags) {
          if (err) return done(err);
          try {
            tags.should.have.property('messageLengthType', 'long');
            return done();
          } catch (err) {
            return done(err);
          }
        });
      });

    it('[not-first-reply message] should not give the key `replyTime`',
      function (done) {
        messageToInfluxService.process(longMessage, function (err, fields) {
          if (err) return done(err);
          try {
            fields.should.not.have.property('replyTime');
            return done();
          } catch (err) {
            return done(err);
          }
        });
      });

    it('[every message] should give field with key `messageLength` and correct length as value',
      function (done) {
        messageToInfluxService.process(message1to2, function (err, fields) {
          if (err) return done(err);
          try {
            fields.should.have.property('messageLength', message1to2.content.length);
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
