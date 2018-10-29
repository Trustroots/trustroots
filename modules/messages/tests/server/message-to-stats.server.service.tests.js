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
    messageToStatsService =
  require(path.resolve('./modules/messages/server/services/message-to-stats.server.service'));
require('should');

// for testing length of long or short messages
var longMessageMinimumLength = config.limits.longMessageMinimumLength;

/**
 * Unit tests
 */
describe('Message to stats server service Unit Tests:', function () {
  var user1,
      user2;

  // here we create the users
  beforeEach(function (done) {

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
    user1.save(function (err) {
      if (err) return done(err);
      user2.save(done);
    });
  });

  // after each test removing all the messages and users
  afterEach(function (done) {
    Message.deleteMany().exec(function () {
      User.deleteMany().exec(done);
    });
  });

  describe('Testing messageToStatsService.process(message)', function () {
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
        // @TODO the test should be refactored.
        // the messages should have a constant given `created` time; It would
        // enable precise testing and avoid the complexity of timeouts which is
        // now
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
        messageToStatsService.process(message1to2, function (err, stat) {
          if (err) return done(err);
          try {
            stat.should.have.propertyByPath('tags', 'position').eql('first');
            return done();
          } catch (err) {
            return done(err);
          }
        });
      });

    it('[first reply] should give tag with key `position` and value `firstReply`',
      function (done) {
        messageToStatsService.process(message2to1, function (err, stat) {
          if (err) return done(err);
          try {
            stat.should.have.propertyByPath('tags', 'position').eql('firstReply');
            return done();
          } catch (e) {
            return done(e);
          }
        });
      });

    it('[first reply] should give value with key `timeToFirstReply` > 0',
      function (done) {
        messageToStatsService.process(message2to1, function (err, stat) {
          if (err) return done(err);
          try {
            stat.should.have.propertyByPath('values', 'timeToFirstReply').above(0);
            return done();
          } catch (err) {
            return done(err);
          }
        });
      });

    it('[not first position nor first reply] should give tag with key `position` and value `other`',
      function (done) {
        messageToStatsService.process(shortMessage, function (err, stat) {
          if (err) return done(err);
          try {
            stat.should.have.propertyByPath('tags', 'position').eql('other');
            return done();
          } catch (err) {
            return done(err);
          }
        });
      });

    it('[short message] stat should contain tag "messageLengthType": "short"',
      function (done) {
        messageToStatsService.process(shortMessage, function (err, stat) {
          if (err) return done(err);
          try {
            stat.should.have.propertyByPath('tags', 'messageLengthType').eql('short');
            return done();
          } catch (err) {
            return done(err);
          }
        });
      });

    it('[short message] stat should contain tag "messageLengthType": "long"',
      function (done) {
        messageToStatsService.process(longMessage, function (err, stat) {
          if (err) return done(err);
          try {
            stat.should.have.propertyByPath('tags', 'messageLengthType').eql('long');
            return done();
          } catch (err) {
            return done(err);
          }
        });
      });

    it('[not-first-reply message] stat should contain tag `timeToFirstReply`',
      function (done) {
        messageToStatsService.process(longMessage, function (err, stat) {
          if (err) return done(err);
          try {
            stat.should.not.have.property('timeToFirstReply');
            return done();
          } catch (err) {
            return done(err);
          }
        });
      });

    it('[every message] stat should contain meta "messageLength" and a correct length as value',
      function (done) {
        messageToStatsService.process(message1to2, function (err, stat) {
          if (err) return done(err);
          try {
            stat.should.have.propertyByPath('meta', 'messageLength').eql(message1to2.content.length);
            return done();
          } catch (err) {
            return done(err);
          }
        });
      });

    it('[every message] stat should contain "time" which is a Date in a specific range',
      // @TODO the test should be rewriten to be more precise (see the todo near
      // creating the testing messages)
      function (done) {
        messageToStatsService.process(message1to2, function (err, stat) {
          if (err) return done(err);
          try {
            stat.should.have.property('time');
            (stat.time).should.be.Date();
            // here we test wheter the number is between now and some not so
            // past time
            (stat.time.getTime() > 1400000000 * 1000).should.be.exactly(true);
            (stat.time.getTime() <= Date.now()).should.be.exactly(true);
            return done();
          } catch (err) {
            return done(err);
          }
        });
      });
  });
});
