'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    should = require('should'),
    async = require('async'),
    _ = require('lodash'),
    sinon = require('sinon'),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Message = mongoose.model('Message'),
    mongooseService = require(path.resolve('./config/lib/mongoose')),
    migration = require(path.resolve('./migrations/1479386133912-refactor-messages'));

/**
 * Globals
 */

describe('Migration of Messages: notified => notificationCount', function () {

  var users;

  var sandbox;

  beforeEach(function () {
    sandbox = sinon.sandbox.create();

    // stub the mongoose connection. we already have one.
    sandbox.stub(mongooseService, 'connect').callsArg(0);
    sandbox.stub(mongooseService, 'disconnect').callsArg(0);
  });

  afterEach(function () {
    sandbox.restore();
  });

  // delete all the users and messages
  afterEach(function (done) {
    User.remove().exec(function (err) {
      if (err) return done(err);
      Message.remove().exec(done);
    });
  });

  // create 2 users
  beforeEach(function (done) {
    users = [];
    createUsers(users, 2, done);
  });

  context('Both notified and unnotified messages exist', function () {

    // create five `notified: true` messages
    beforeEach(function (done) {
      createMessages(users, 5, true, done);
    });

    // create 7 `notified: false` messages
    beforeEach(function (done) {
      createMessages(users, 7, false, done);
    });

    it('Migrate all the notified and unnotified messages', function (done) {

      // test that before the messages resemble the old version
      Message.find({}, function (err, messages) {
        if (err) return done(err);

        messages = _.map(messages, function (msg) {
          return msg.toJSON();
        });

        should(messages.length).equal(12);

        _.each(messages, function (msg) {
          should(msg).have.property('notified').equalOneOf(true, false);
          should(msg).not.have.property('notificationCount', 2);
        });

        // run the migration
        migration.up(function (err) {
          if (err) return done(err);

          // find the unnotified messages
          Message.find({ notificationCount: 0 }, function (err, unnotified) {

            should(unnotified.length).equal(7);

            // check that the message properties are migrated
            should(unnotified).matchEach(function (msg) {
              should(msg).not.have.property('notified');
              should(msg).have.property('notificationCount', 0);
            });

            // find the notified messages
            Message.find({ notificationCount: 2 }, function (err, notified) {

              should(notified.length).equal(5);

              // check that the message properties are migrated
              should(notified).matchEach(function (msg) {
                should(msg).not.have.property('notified');
                should(msg).have.property('notificationCount', 2);
              });

              return done();
            });
          });
        });

      });
    });
  });


  // helper functions
  // TODO JSDoc
  // create old version of messages
  function createMessages(users, count, isNotified, done) {

    async.eachSeries(_.range(count), function (i, cb) {

      // create and save a new message
      var _message = {
        userFrom: users[0]._id,
        userTo: users[1]._id,
        content: 'a message',
        read: false,
        notified: isNotified
      };

      var message = new Message(_message);
      // save
      message.save(function (err, message) {
        // update to the later version
        message.update({
          $set: { notified: isNotified },
          $unset: { notificationCount: '' }
        }, { strict: false }, function (err) {
          return cb(err);
        });
      });
    }, function (err) {
      return done(err);
    });
  }

  // create users
  function createUsers(userArray, count, done) {
    async.eachSeries(_.range(count), function (i, cb) {
      var _user = {
        public: true,
        firstName: 'FirstName' + i,
        lastName: 'LastName' + i,
        get displayName() {
          return this.firstName + ' ' + this.lastName;
        },
        email: 'user' + i + '@example.com',
        username: 'user' + i,
        displayUsername: 'user' + i,
        password: 'password',
        provider: 'local'
      };

      var user = new User(_user);

      // Save a user to the test db
      userArray.push(user);

      user.save(cb);
    }, done);
  }
});
