'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    // should = require('should'),
    moment = require('moment'),
    testutils = require(path.resolve('./testutils')),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Message = mongoose.model('Message');

/**
 * Globals
 */
var userFrom,
    _userFrom,
    userFromId,
    userTo,
    _userTo,
    userToId,
    _message,
    message,
    messageUnreadJobHandler;

describe('Job: message unread', function() {

  var jobs = testutils.catchJobs();

  before(function() {
    messageUnreadJobHandler = require(path.resolve('./modules/messages/server/jobs/message-unread.server.job'));
  });

  // Create an user
  beforeEach(function (done) {

    // Create a new user
    _userFrom = {
      public: true,
      firstName: 'FullFrom',
      lastName: 'NameFrom',
      displayName: 'FullFrom NameFrom',
      email: 'userfrom@test.com',
      username: 'userfrom',
      displayUsername: 'userfrom',
      password: 'M3@n.jsI$Aw3$0m4',
      provider: 'local'
    };

    userFrom = new User(_userFrom);

    // Save a user to the test db
    userFrom.save(function(err, user) {
      userFromId = user._id;
      done();
    });
  });

  // Create another user
  beforeEach(function (done) {

    _userTo = {
      public: true,
      firstName: 'FullTo',
      lastName: 'NameTo',
      displayName: 'FullTo NameTo',
      email: 'userto@test.com',
      username: 'userto',
      displayUsername: 'userto',
      password: 'M3@n.jsI$Aw3$0m4',
      provider: 'local'
    };

    userTo = new User(_userTo);

    // Save a user to the test db
    userTo.save(function(err, user) {
      userToId = user._id;
      done();
    });
  });

  // Create a message
  beforeEach(function (done) {

    _message = {
      userFrom: userFromId,
      userTo: userToId,
      content: 'a message',
      read: false,
      notified: false
    };

    message = new Message(_message);

    // Save a message to the test db
    message.save(done);
  });

  it('Do not remind user about unread messages which are sent less than 10 minutes ago', function(done) {
    message.created = moment().subtract(moment.duration({ 'minutes': 9 }));
    message.save();
    messageUnreadJobHandler({}, function(err) {
      if (err) return done(err);

      jobs.length.should.equal(0);
      done();
    });
  });

  it('Remind user about unread messages which are sent more than 10 minutes ago', function(done) {
    message.created = moment().subtract(moment.duration({ 'minutes': 10, 'seconds': 1 }));
    message.save(function(err) {
      if (err) return done(err);

      messageUnreadJobHandler({}, function(err) {
        if (err) return done(err);

        jobs.length.should.equal(1);
        jobs[0].type.should.equal('send email');
        jobs[0].data.subject.should.equal(_userFrom.displayName + ' wrote you from Trustroots');
        jobs[0].data.to.address.should.equal(_userTo.email);
        Message.find({}, function(err, messages) {
          if (err) return done(err);
          messages[0].notified.should.equal(true);
          done();
        });
      });
    });
  });

  it('Remind user about multiple unread messages from same user in one notification email', function(done) {

    var message2 = new Message(_message);
    message2.created = moment().subtract(moment.duration({ 'minutes': 11 }));
    message2.save(function(err) {
      if (err) return done(err);

      message.created = moment().subtract(moment.duration({ 'minutes': 10, 'seconds': 1 }));
      message.save(function(err) {
        if (err) return done(err);

        messageUnreadJobHandler({}, function(err) {
          if (err) return done(err);

          jobs.length.should.equal(1);
          jobs[0].type.should.equal('send email');
          jobs[0].data.subject.should.equal(_userFrom.displayName + ' wrote you from Trustroots');
          jobs[0].data.to.address.should.equal(_userTo.email);
          Message.find({}, function(err, messages) {
            if (err) return done(err);
            messages[0].notified.should.equal(true);
            done();
          });
        });
      });
    });
  });

  it('Remind user about multiple unread messages from multiple users in separate notification emails', function(done) {

    var _user3 = {
      public: true,
      firstName: 'Full3',
      lastName: 'Name3',
      displayName: 'Full3 Name3',
      email: 'user3@test.com',
      username: 'user3',
      displayUsername: 'user3',
      password: 'M3@n.jsI$Aw3$0m4',
      provider: 'local'
    };
    var user3 = new User(_user3);
    user3.save(function(err, user) {
      if (err) return done(err);
      var message2 = new Message(_message);
      message2.created = moment().subtract(moment.duration({ 'minutes': 11 }));
      message2.userFrom = user._id;
      message2.save(function(err) {
        if (err) return done(err);

        message.created = moment().subtract(moment.duration({ 'minutes': 10, 'seconds': 1 }));
        message.save(function(err) {
          if (err) return done(err);

          messageUnreadJobHandler({}, function(err) {
            if (err) return done(err);

            // Agenda sets jobs in random order, figure out order here
            var user3Order = 1;
            var userFromOrder = 0;
            if (jobs[0].data.subject === _user3.displayName + ' wrote you from Trustroots') {
              user3Order = 0;
              userFromOrder = 1;
            }

            jobs.length.should.equal(2);
            jobs[user3Order].data.subject.should.equal(_user3.displayName + ' wrote you from Trustroots');
            jobs[userFromOrder].data.subject.should.equal(_userFrom.displayName + ' wrote you from Trustroots');
            jobs[user3Order].data.to.address.should.equal(_userTo.email);
            jobs[userFromOrder].data.to.address.should.equal(_userTo.email);
            Message.find({}, function(err, messages) {
              if (err) return done(err);
              messages.length.should.equal(2);
              messages[0].notified.should.equal(true);
              messages[1].notified.should.equal(true);
              done();
            });
          });
        });
      });
    });
  });

  it('Ignore notification messages from removed users', function(done) {
    message.created = moment().subtract(moment.duration({ 'minutes': 10, 'seconds': 1 }));
    message.save(function(err) {
      if (err) return done(err);
      userFrom.remove(function(err) {
        if (err) return done(err);

        messageUnreadJobHandler({}, function(err) {
          if (err) return done(err);

          jobs.length.should.equal(0);
          Message.find({}, function(err, messages) {
            if (err) return done(err);
            messages[0].notified.should.equal(true);
            done();
          });
        });
      });
    });
  });

  it('Ignore notification messages from removed users but do not stop processing other notifications', function(done) {

    var message2 = new Message(_message);
    message2.created = moment().subtract(moment.duration({ 'minutes': 11 }));

    // Attach non-existing user to this message
    // eslint-disable-next-line new-cap
    message2.userFrom = mongoose.Types.ObjectId();
    message2.save(function(err) {
      if (err) return done(err);

      message.created = moment().subtract(moment.duration({ 'minutes': 10, 'seconds': 1 }));
      message.save(function(err) {
        if (err) return done(err);

        messageUnreadJobHandler({}, function(err) {
          if (err) return done(err);

          jobs.length.should.equal(1);
          jobs[0].data.subject.should.equal(_userFrom.displayName + ' wrote you from Trustroots');
          jobs[0].data.to.address.should.equal(_userTo.email);
          Message.find({}, function(err, messages) {
            if (err) return done(err);
            messages[0].notified.should.equal(true);
            messages[1].notified.should.equal(true);
            done();
          });
        });
      });
    });
  });

  afterEach(function (done) {
    User.remove().exec(function() {
      Message.remove().exec(done);
    });
  });
});
