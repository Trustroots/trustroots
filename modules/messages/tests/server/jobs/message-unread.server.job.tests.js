/**
 * Module dependencies.
 */
const path = require('path');
const should = require('should');
const moment = require('moment');
const sinon = require('sinon');
const testutils = require(path.resolve('./testutils/server/server.testutil'));
const mongoose = require('mongoose');
const User = mongoose.model('User');
const Message = mongoose.model('Message');

/**
 * Globals
 */
let userFrom;
let _userFrom;
let userFromId;
let userTo;
let _userTo;
let userToId;
let _message;
let message;
let messageUnreadJobHandler;

describe('Job: message unread', function () {
  const jobs = testutils.catchJobs();

  before(function () {
    messageUnreadJobHandler = require(path.resolve(
      './modules/messages/server/jobs/message-unread.server.job',
    ));
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
      password: 'M3@n.jsI$Aw3$0m4',
      provider: 'local',
      roles: ['user'],
    };

    userFrom = new User(_userFrom);

    // Save a user to the test db
    userFrom.save(function (err, user) {
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
      password: 'M3@n.jsI$Aw3$0m4',
      provider: 'local',
      roles: ['user'],
    };

    userTo = new User(_userTo);

    // Save a user to the test db
    userTo.save(function (err, user) {
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
      notificationCount: 0,
    };

    message = new Message(_message);

    // Save a message to the test db
    message.save(done);
  });

  it('Do not remind user about unread messages which are sent less than 10 minutes ago', function (done) {
    message.created = moment().subtract(moment.duration({ minutes: 9 }));
    message.save();
    messageUnreadJobHandler({}, function (err) {
      if (err) return done(err);

      jobs.length.should.equal(0);
      done();
    });
  });

  it('Remind user about unread messages which are sent more than 10 minutes ago', function (done) {
    message.created = moment().subtract(
      moment.duration({ minutes: 10, seconds: 1 }),
    );
    message.save(function (err) {
      if (err) return done(err);

      messageUnreadJobHandler({}, function (err) {
        if (err) return done(err);

        jobs.length.should.equal(1);
        jobs[0].type.should.equal('send email');
        jobs[0].data.subject.should.equal(
          _userFrom.displayName + ' wrote you from Trustroots',
        );
        jobs[0].data.to.address.should.equal(_userTo.email);
        Message.find({}, function (err, messages) {
          if (err) return done(err);
          messages[0].notificationCount.should.equal(1);
          done();
        });
      });
    });
  });

  it('Remind user about multiple unread messages from same user in one notification email', function (done) {
    const message2 = new Message(_message);
    message2.created = moment().subtract(moment.duration({ minutes: 11 }));
    message2.save(function (err) {
      if (err) return done(err);

      message.created = moment().subtract(
        moment.duration({ minutes: 10, seconds: 1 }),
      );
      message.save(function (err) {
        if (err) return done(err);

        messageUnreadJobHandler({}, function (err) {
          if (err) return done(err);

          jobs.length.should.equal(1);
          jobs[0].type.should.equal('send email');
          jobs[0].data.subject.should.equal(
            _userFrom.displayName + ' wrote you from Trustroots',
          );
          jobs[0].data.to.address.should.equal(_userTo.email);
          Message.find({}, function (err, messages) {
            if (err) return done(err);
            messages[0].notificationCount.should.equal(1);
            done();
          });
        });
      });
    });
  });

  it('Remind user about multiple unread messages from multiple users in separate notification emails', function (done) {
    const _user3 = {
      public: true,
      firstName: 'Full3',
      lastName: 'Name3',
      displayName: 'Full3 Name3',
      email: 'user3@test.com',
      username: 'user3',
      password: 'M3@n.jsI$Aw3$0m4',
      provider: 'local',
    };
    const user3 = new User(_user3);
    user3.save(function (err, user) {
      if (err) return done(err);
      const message2 = new Message(_message);
      message2.created = moment().subtract(moment.duration({ minutes: 11 }));
      message2.userFrom = user._id;
      message2.save(function (err) {
        if (err) return done(err);

        message.created = moment().subtract(
          moment.duration({ minutes: 10, seconds: 1 }),
        );
        message.save(function (err) {
          if (err) return done(err);

          messageUnreadJobHandler({}, function (err) {
            if (err) return done(err);

            // Agenda sets jobs in random order, figure out order here
            let user3Order = 1;
            let userFromOrder = 0;
            if (
              jobs[0].data.subject ===
              _user3.displayName + ' wrote you from Trustroots'
            ) {
              user3Order = 0;
              userFromOrder = 1;
            }

            jobs.length.should.equal(2);
            jobs[user3Order].data.subject.should.equal(
              _user3.displayName + ' wrote you from Trustroots',
            );
            jobs[userFromOrder].data.subject.should.equal(
              _userFrom.displayName + ' wrote you from Trustroots',
            );
            jobs[user3Order].data.to.address.should.equal(_userTo.email);
            jobs[userFromOrder].data.to.address.should.equal(_userTo.email);
            Message.find({}, function (err, messages) {
              if (err) return done(err);
              messages.length.should.equal(2);
              messages[0].notificationCount.should.equal(1);
              messages[1].notificationCount.should.equal(1);
              done();
            });
          });
        });
      });
    });
  });

  it('Ignore notification messages from removed users', function (done) {
    message.created = moment().subtract(
      moment.duration({ minutes: 10, seconds: 1 }),
    );
    message.save(function (err) {
      if (err) return done(err);
      userFrom.remove(function (err) {
        if (err) return done(err);

        messageUnreadJobHandler({}, function (err) {
          if (err) return done(err);

          jobs.length.should.equal(0);
          Message.find({}, function (err, messages) {
            if (err) return done(err);
            messages[0].notificationCount.should.equal(1);
            done();
          });
        });
      });
    });
  });

  it('Ignore notification messages from removed users but do not stop processing other notifications', function (done) {
    const message2 = new Message(_message);
    message2.created = moment().subtract(moment.duration({ minutes: 11 }));

    // Attach non-existing user to this message
    // eslint-disable-next-line new-cap
    message2.userFrom = mongoose.Types.ObjectId();
    message2.save(function (err) {
      if (err) return done(err);

      message.created = moment().subtract(
        moment.duration({ minutes: 10, seconds: 1 }),
      );
      message.save(function (err) {
        if (err) return done(err);

        messageUnreadJobHandler({}, function (err) {
          if (err) return done(err);

          jobs.length.should.equal(1);
          jobs[0].data.subject.should.equal(
            _userFrom.displayName + ' wrote you from Trustroots',
          );
          jobs[0].data.to.address.should.equal(_userTo.email);
          Message.find({}, function (err, messages) {
            if (err) return done(err);
            messages[0].notificationCount.should.equal(1);
            messages[1].notificationCount.should.equal(1);
            done();
          });
        });
      });
    });
  });

  context('further notifications configured', function () {
    // helpful function to convert readable (momentjs) duration to milliseconds
    function milliseconds(duration) {
      return moment.duration(duration).asMilliseconds();
    }

    beforeEach(function () {
      // set the fake time with sinon
      // http://sinonjs.org/releases/v1.17.7/fake-timers/
      sinon.useFakeTimers(1500000000000);
    });

    // restore the original state
    afterEach(function () {
      sinon.restore();
    });

    it('Remind user again after a specified time.', function (done) {
      // update: message is created at the current time
      message.created = new Date();
      message.save(function (err) {
        if (err) return done(err);

        // wait for 10 minutes
        sinon.clock.tick(milliseconds({ minutes: 10, milliseconds: 1 }));

        messageUnreadJobHandler({}, function (err) {
          if (err) return done(err);

          // check that the first reminder is sent
          jobs.length.should.equal(1);

          // wait for 24 hours
          sinon.clock.tick(milliseconds({ hours: 23, minutes: 50 }));

          messageUnreadJobHandler({}, function (err) {
            if (err) return done(err);

            // check that the second reminder is sent
            jobs.length.should.equal(2);

            return done();
          });
        });
      });
    });

    it('Send only one notification for replied threads.', function (done) {
      // send a message before in opposite direction
      const messageBefore = new Message({
        userFrom: _message.userTo, // opposite direction
        userTo: _message.userFrom,
        content: 'a message before',
        read: true,
        notificationCount: 0,
      });

      messageBefore.save(function (err) {
        if (err) return done(err);

        // wait a minute
        sinon.clock.tick(milliseconds({ minutes: 1 }));

        // update: message is created at the current time
        message.created = new Date();
        message.save(function (err) {
          if (err) return done(err);

          // wait for 10 minutes
          sinon.clock.tick(milliseconds({ minutes: 10, milliseconds: 1 }));

          messageUnreadJobHandler({}, function (err) {
            if (err) return done(err);

            // check that the first reminder is sent
            jobs.length.should.equal(1);

            // wait for 24 hours
            sinon.clock.tick(milliseconds({ hours: 23, minutes: 50 }));

            messageUnreadJobHandler({}, function (err) {
              if (err) return done(err);

              // check that the second reminder _is not_ sent
              jobs.length.should.equal(1);

              return done();
            });
          });
        });
      });
    });

    it('Send a further notification for unreplied threads.', function (done) {
      // send a message before in the same direction
      const messageBefore = new Message({
        userFrom: _message.userFrom,
        userTo: _message.userTo,
        content: 'a message before',
        read: true,
        notificationCount: 0,
      });

      messageBefore.save(function (err) {
        if (err) return done(err);

        // wait a minute
        sinon.clock.tick(milliseconds({ minutes: 1 }));

        // update: message is created at the current time
        message.created = new Date();
        message.save(function (err) {
          if (err) return done(err);

          // wait for 10 minutes
          sinon.clock.tick(milliseconds({ minutes: 10, milliseconds: 1 }));

          messageUnreadJobHandler({}, function (err) {
            if (err) return done(err);

            // check that the first reminder is sent
            jobs.length.should.equal(1);

            // wait for 24 hours
            sinon.clock.tick(milliseconds({ hours: 23, minutes: 50 }));

            messageUnreadJobHandler({}, function (err) {
              if (err) return done(err);

              // check that the second reminder _is_ sent
              jobs.length.should.equal(2);

              return done();
            });
          });
        });
      });
    });

    it('Let the further notification text be different from the first one.', function (done) {
      // update: message is created at the current time
      message.created = new Date();
      message.save(function (err) {
        if (err) return done(err);

        // wait for 10 minutes
        sinon.clock.tick(milliseconds({ minutes: 10, milliseconds: 1 }));

        messageUnreadJobHandler({}, function (err) {
          if (err) return done(err);

          // check that the first reminder is sent
          jobs.length.should.equal(1);
          // check the correctness of the content of the first reminder
          jobs[0].data.subject.should.equal(
            _userFrom.displayName + ' wrote you from Trustroots',
          );
          jobs[0].data.to.address.should.equal(_userTo.email);

          // wait for 24 hours
          sinon.clock.tick(milliseconds({ hours: 23, minutes: 50 }));

          messageUnreadJobHandler({}, function (err) {
            if (err) return done(err);

            // check that the second reminder is sent
            jobs.length.should.equal(2);
            // check the correctness of the content of the second reminder
            jobs[1].data.subject.should.equal(
              _userFrom.displayName +
                ' is still waiting for a reply on Trustroots',
            );
            jobs[1].data.to.address.should.equal(_userTo.email);

            return done();
          });
        });
      });
    });

    it("When we didn't send the first notification on time for some erroneous reason, send just one; not two of them at the same time.", function (done) {
      // update: message is created at the current time
      message.created = new Date();
      message.save(function (err) {
        if (err) return done(err);

        // wait for 24 hours
        sinon.clock.tick(milliseconds({ hours: 24, milliseconds: 1 }));

        messageUnreadJobHandler({}, function (err) {
          if (err) return done(err);

          // check that the first reminder is sent
          jobs.length.should.equal(1);
          jobs[0].data.subject.should.equal(
            _userFrom.displayName + ' wrote you from Trustroots',
          );

          return done();
        });
      });
    });

    it("Don't send further notification about very old messages.", function (done) {
      // update: message is created at the current time
      message.created = new Date();
      message.save(function (err) {
        if (err) return done(err);

        // wait for 10 minutes
        sinon.clock.tick(milliseconds({ minutes: 10, milliseconds: 1 }));

        messageUnreadJobHandler({}, function (err) {
          if (err) return done(err);

          // check that the first reminder is sent
          jobs.length.should.equal(1);

          // wait for 14 days
          sinon.clock.tick(milliseconds({ days: 14 }));

          messageUnreadJobHandler({}, function (err) {
            if (err) return done(err);

            // check that the second reminder is not sent
            jobs.length.should.equal(1);

            return done();
          });
        });
      });
    });

    ['suspended', 'shadowban'].forEach(function(role) {
      it(`Don't send notifications from users with role "${role}".`, function(done) {
        message.created = moment().subtract(
          moment.duration({ minutes: 10, seconds: 1 }),
        );
        message.save(function(err) {
          should.not.exist(err);

          userFrom.roles = ['user', role];
          userFrom.save(function(err) {
            should.not.exist(err);

            messageUnreadJobHandler({}, function(err) {
              should.not.exist(err);

              jobs.length.should.equal(0);

              return done();
            });
          });
        });
      });
    });
  });

  afterEach(function (done) {
    User.deleteMany().exec(function () {
      Message.deleteMany().exec(done);
    });
  });
});
