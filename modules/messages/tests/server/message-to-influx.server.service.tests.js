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

  describe('Testing messageToInfluxService.process', function () {

    // defining some messages which will be later used for testing
    // note: the userFrom and userTo is not existent at this point, yet
    var message1to2 = { content: 'message content' };
    var message2to1 = { content: 'message content' };
    var shortMessage = { content: 'short content' };
    // setting a long message
    var longString = '0123456789';
    for (var i = 0; i < 5; ++i) {
      var output = longString + longString;
      longString = output;
    }
    var longMessage = { content: longString };

    // here we populate prepared message objects with userFrom & userTo
    // now they finally exist (after running the previous beforeEach)
    beforeEach(function () {
      message1to2.userFrom = user1._id;
      message1to2.userTo = user2._id;
      message2to1.userFrom = user2._id;
      message2to1.userTo = user1._id;
      shortMessage.userFrom = user1._id;
      shortMessage.userTo = user2._id;
      longMessage.userFrom = user1._id;
      longMessage.userTo = user2._id;
    });

    context('The first message', testKeyAndValue([], message1to2, 'tag',
      'position', 'first'));

    context('The first reply', testKeyAndValue([message2to1], message1to2, 'tag',
      'position', 'first_reply'));

    context('The other message', testKeyAndValue([message2to1, message1to2],
      message1to2, 'tag', 'position', 'other'));

    context('The short message', testKeyAndValue([], shortMessage, 'tag',
      'msgLengthType', 'short'));

    context('The long message', testKeyAndValue([], longMessage, 'tag',
      'msgLengthType', 'long'));

    // too lazy to write test for the actual amount of reply time
    context('The first reply', testKeyAndValue([message2to1], message1to2,
      'field', 'replyTime'));

    context('Other messages', testKeyAndValue([], message1to2,
      'field', 'replyTime', -1));

    context('Any message (correct length number)', testKeyAndValue([], longMessage, 'field',
      'msgLength', longMessage.content.length));

    context('All messages', testKeyAndValue([], message1to2,
      'field', 'time'));

    /**
     * the preparation function for testing keys and values of the process
     * function
     * @param {Object[]} messagesBefore - array of object that would go to 'new
     * Message(param) before saving to mongoDB via mongoose'
     * @param {string} messagesBefore[].content - a message content
     * @param {string|Object} messagesBefore[].userFrom - message sender's id
     * (id in form of string or idObject (whatever mongoose accepts))
     * @param {string|Object} messagesBefore[].userTo - message receiver's id
     * (id in form of string or idObject (whatever mongoose accepts))
     * @param {Object} messageToProcess - object that would go to new Message()
     * @param {string} fieldOrTag - do we test field or tag? provide 'field' or
     * 'tag'
     * @param {string} key - field or tag key as will be saved to influxDB
     * @param {mixed} value - field or tag value as will be saved to influxDB
     * if not present, we test for the presence of the field only
     * @returns {function} - the returned function is ready to be a second
     * parameter of context();
     */
    function testKeyAndValue(messagesBefore, messageToProcess, fieldOrTag, key, value) {
      // we wish to check whether the value is provided
      var arglen = arguments.length;

      return function () {
        // create some initial message(s)
        beforeEach(function (done) {
          async.eachSeries(messagesBefore, saveMessage, done);
          function saveMessage(message, callback) {
            var messageDB = new Message(message);
            messageDB.save(callback);
          }
        });

        // showing value in test name or not
        var valueString = arglen === 5 ? ': ' + value : '';
        // the test itself
        it('result tags should have property ' + key + valueString, function (done) {
          var message = new Message(messageToProcess);

          // creating te message
          message.save(function (err, result) {
            if (err) return done(err);

            // processing the message (running the actual tested module)
            messageToInfluxService.process(result, function (err, fields, tags) {
              if (err) return done(err);

              // checking the results
              // do we check fields or tags?
              var testedObject;
              switch (fieldOrTag) {
                case 'field':
                  testedObject = fields;
                  break;
                case 'tag':
                  testedObject = tags;
                  break;
                default:
                  return done(new Error('do we test fields or tags?'));
              }
              // how do we actually use the 'should' library asynchronously?
              // is it possible to run these tests without try catch? where will
              // be the done(err) then?
              try {
                if (arglen === 5) { // value provided
                  // testing the key and its value
                  testedObject.should.have.property(key, value);
                } else if (arglen === 4) { // value not provided
                  // testing the key only
                  testedObject.should.have.property(key);
                } else {
                  return done(new Error('wrong number of parameters provided'));
                }
                return done();
              } catch (err) {
                return done(err);
              }
            });
          });
        });
      };
    }
  });
});
