import type {
  MessageDocument,
  MessageModel,
  MessageRecord,
  UserModelDocument,
  UserModel,
  UserRecord,
} from '../../../../../testutils/server/model-contracts.mts';
/**
 * Module dependencies.
 */
require('should');
const moment: typeof import('moment') = require('moment');
const emailService: typeof import('./../../../../core/server/services/email.server.service.mjs') = require('./../../../../core/server/services/email.server.service.mjs');
const sinon: typeof import('sinon') = require('sinon');
const winston: typeof import('winston') = require('winston');
const unifiedPush: typeof import('./../../../../users/server/services/unified-push.server.service.mjs') = require('./../../../../users/server/services/unified-push.server.service.mjs');
const testutils: typeof import('../../../../../testutils/server/server.testutil') = require('../../../../../testutils/server/server.testutil');
const mongoose: typeof import('mongoose') = require('mongoose');
const webPush: typeof import('../../../../users/server/services/web-push.server.transport.mts').webPush =
  require('../../../../users/server/services/web-push.server.transport.mts').webPush;
const User = mongoose.model<UserRecord, UserModel>('User');
const Message = mongoose.model<MessageRecord, MessageModel>('Message');
const Registration = mongoose.model('UnifiedPushRegistration');

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('Expected value');
  return value;
}

/**
 * Globals
 */
let userFrom: UserModelDocument;
let _userFrom: UserRecord;
let userFromId: UserModelDocument['_id'];
let userTo: UserModelDocument;
let _userTo: UserRecord;
let userToId: UserModelDocument['_id'];
let _message: MessageRecord;
let message: MessageDocument;
let messageUnreadJobHandler: typeof import('./../../../server/jobs/message-unread.server.job.mjs').run;

describe('Job: message unread', function () {
  const jobs = testutils.catchJobs<{
    subject: string;
    to: { address: string };
  }>();

  before(function () {
    messageUnreadJobHandler = require('./../../../server/jobs/message-unread.server.job.mjs');
  });

  // Create an user
  beforeEach(async function () {
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
    };

    userFrom = new User(_userFrom);

    // Save a user to the test db
    const user = await userFrom.save();
    userFromId = user._id;
  });

  // Create another user
  beforeEach(async function () {
    _userTo = {
      public: true,
      firstName: 'FullTo',
      lastName: 'NameTo',
      displayName: 'FullTo NameTo',
      email: 'userto@test.com',
      username: 'userto',
      password: 'M3@n.jsI$Aw3$0m4',
      provider: 'local',
    };

    userTo = new User(_userTo);

    // Save a user to the test db
    const user = await userTo.save();
    userToId = user._id;
  });

  // Create a message
  beforeEach(async function () {
    _message = {
      userFrom: userFromId,
      userTo: userToId,
      content: 'a message',
      read: false,
      notificationCount: 0,
    };

    message = new Message(_message);

    // Save a message to the test db
    await message.save();
  });

  it('Do not remind user about unread messages which are sent less than 10 minutes ago', async function () {
    message.created = moment()
      .subtract(moment.duration({ minutes: 9 }))
      .toDate();
    await message.save();
    await new Promise<void>((resolve, reject) => {
      messageUnreadJobHandler({}, (err?: Error | null) =>
        err ? reject(err) : resolve(),
      );
    });
    jobs.length.should.equal(0);
  });

  it('Remind user about unread messages which are sent more than 10 minutes ago', function (done) {
    message.created = moment()
      .subtract(moment.duration({ minutes: 10, seconds: 1 }))
      .toDate();
    message
      .save()
      .then(function () {
        messageUnreadJobHandler({}, function (err?: Error | null) {
          if (err) return done(err);

          jobs.length.should.equal(1);
          jobs[0].type.should.equal('send email');
          jobs[0].data.subject.should.equal(
            _userFrom.displayName + ' wrote you from Trustroots',
          );
          jobs[0].data.to.address.should.equal(_userTo.email);
          Message.find({})
            .exec()
            .then(function (messages) {
              required(required(messages[0]).notificationCount).should.equal(1);
              done();
            })
            .catch(function (err) {
              if (typeof done === 'function') return done(err);
              throw err;
            });
        });
      })
      .catch(err => done(err));
  });

  it('sends one generic UnifiedPush alert with the first eligible reminder', async function () {
    const pushService = require('./../../../../users/server/services/unified-push.server.service.mjs');
    await pushService.register(userToId, {
      endpoint: 'https://ntfy.sh/anonymous-unread-test',
      publicKey:
        'BNPRQG83KHuc4ZkSKlmSKQWC3PQm2YD-yOiPdjFbQyB8VM6ZZSLD2caRpXad6G_2qXqb_WUz7V2T7w1KqAXbslQ',
      auth: 'abcdefghijklmnopqrstuv',
    });
    message.created = moment().subtract({ minutes: 10, seconds: 1 }).toDate();
    await message.save();
    await new Message({
      ..._message,
      created: moment().subtract({ minutes: 11 }).toDate(),
    }).save();
    let finishPush: () => void = () => {};
    const pushed = new Promise<void>(resolve => {
      finishPush = resolve;
    });
    const sent = sinon.stub(webPush, 'sendNotification').callsFake(() => {
      finishPush();
      return Promise.resolve();
    });
    sinon.stub(webPush, 'setVapidDetails');
    try {
      await new Promise<void>((resolve, reject) => {
        messageUnreadJobHandler({}, (error?: Error | null) =>
          error ? reject(error) : resolve(),
        );
      });
      await pushed;
      sent.calledOnce.should.equal(true);
      required(sent.firstCall.args[1]).should.equal(
        JSON.stringify({ senderId: userFromId.toString() }),
      );
      jobs.length.should.equal(1);
    } finally {
      sinon.restore();
    }
  });

  it('still schedules the email when UnifiedPush delivery fails', async function () {
    const pushService = require('./../../../../users/server/services/unified-push.server.service.mjs');
    const notifyUnread = sinon
      .stub(pushService, 'notifyUnread')
      .rejects(new Error('push unavailable'));
    message.created = moment().subtract({ minutes: 10, seconds: 1 }).toDate();
    await message.save();

    try {
      await new Promise<void>((resolve, reject) => {
        messageUnreadJobHandler({}, (error?: Error | null) =>
          error ? reject(error) : resolve(),
        );
      });
      await new Promise<void>(resolve => setImmediate(resolve));
      notifyUnread.calledOnce.should.equal(true);
      jobs.length.should.equal(1);
      jobs[0].type.should.equal('send email');
    } finally {
      notifyUnread.restore();
    }
  });

  it('Remind user about multiple unread messages from same user in one notification email', function (done) {
    const message2 = new Message(_message);
    message2.created = moment()
      .subtract(moment.duration({ minutes: 11 }))
      .toDate();
    message2
      .save()
      .then(function () {
        message.created = moment()
          .subtract(moment.duration({ minutes: 10, seconds: 1 }))
          .toDate();
        message
          .save()
          .then(function () {
            messageUnreadJobHandler({}, function (err?: Error | null) {
              if (err) return done(err);

              jobs.length.should.equal(1);
              jobs[0].type.should.equal('send email');
              jobs[0].data.subject.should.equal(
                _userFrom.displayName + ' wrote you from Trustroots',
              );
              jobs[0].data.to.address.should.equal(_userTo.email);
              Message.find({})
                .exec()
                .then(function (messages) {
                  required(
                    required(messages[0]).notificationCount,
                  ).should.equal(1);
                  done();
                })
                .catch(function (err) {
                  if (typeof done === 'function') return done(err);
                  throw err;
                });
            });
          })
          .catch(function (err) {
            if (typeof done === 'function') return done(err);
            throw err;
          });
      })
      .catch(err => done(err));
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
    user3
      .save()
      .then(function (user) {
        const message2 = new Message(_message);
        message2.created = moment()
          .subtract(moment.duration({ minutes: 11 }))
          .toDate();
        message2.userFrom = user._id;
        message2
          .save()
          .then(function () {
            message.created = moment()
              .subtract(moment.duration({ minutes: 10, seconds: 1 }))
              .toDate();
            message
              .save()
              .then(function () {
                messageUnreadJobHandler({}, function (err?: Error | null) {
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
                  jobs[userFromOrder].data.to.address.should.equal(
                    _userTo.email,
                  );
                  Message.find({})
                    .exec()
                    .then(function (messages) {
                      messages.length.should.equal(2);
                      required(
                        required(messages[0]).notificationCount,
                      ).should.equal(1);
                      required(
                        required(messages[1]).notificationCount,
                      ).should.equal(1);
                      done();
                    })
                    .catch(function (err) {
                      if (typeof done === 'function') return done(err);
                      throw err;
                    });
                });
              })
              .catch(function (err) {
                if (typeof done === 'function') return done(err);
                throw err;
              });
          })
          .catch(function (err) {
            if (typeof done === 'function') return done(err);
            throw err;
          });
      })
      .catch(err => done(err));
  });

  it('Ignore notification messages from removed users', function (done) {
    message.created = moment()
      .subtract(moment.duration({ minutes: 10, seconds: 1 }))
      .toDate();
    message
      .save()
      .then(function () {
        userFrom
          .deleteOne()
          .then(function () {
            messageUnreadJobHandler({}, function (err?: Error | null) {
              if (err) return done(err);

              jobs.length.should.equal(0);
              Message.find({})
                .exec()
                .then(function (messages) {
                  required(
                    required(messages[0]).notificationCount,
                  ).should.equal(1);
                  done();
                })
                .catch(function (err) {
                  if (typeof done === 'function') return done(err);
                  throw err;
                });
            });
          })
          .catch(function (err) {
            if (typeof done === 'function') return done(err);
            throw err;
          });
      })
      .catch(err => done(err));
  });

  it('Suppress reminder emails when sender is shadowbanned', function (done) {
    message.created = moment()
      .subtract(moment.duration({ minutes: 10, seconds: 1 }))
      .toDate();
    message
      .save()
      .then(function () {
        userFrom.roles = ['user', 'shadowban'];
        userFrom
          .save()
          .then(function () {
            messageUnreadJobHandler({}, function (err?: Error | null) {
              if (err) return done(err);

              jobs.length.should.equal(0);
              Message.find({})
                .exec()
                .then(function (messages) {
                  required(
                    required(messages[0]).notificationCount,
                  ).should.equal(1);
                  done();
                })
                .catch(function (err) {
                  if (typeof done === 'function') return done(err);
                  throw err;
                });
            });
          })
          .catch(function (err) {
            if (typeof done === 'function') return done(err);
            throw err;
          });
      })
      .catch(err => done(err));
  });

  it('does not push when a sender is shadowbanned', async function () {
    const pushService = require('./../../../../users/server/services/unified-push.server.service.mjs');
    await pushService.register(userToId, {
      endpoint: 'https://ntfy.sh/anonymous-restricted-test',
      publicKey:
        'BNPRQG83KHuc4ZkSKlmSKQWC3PQm2YD-yOiPdjFbQyB8VM6ZZSLD2caRpXad6G_2qXqb_WUz7V2T7w1KqAXbslQ',
      auth: 'abcdefghijklmnopqrstuv',
    });
    message.created = moment().subtract({ minutes: 10, seconds: 1 }).toDate();
    await message.save();
    userFrom.roles = ['user', 'shadowban'];
    await userFrom.save();
    const sent = sinon.stub(webPush, 'sendNotification');
    try {
      await new Promise<void>((resolve, reject) => {
        messageUnreadJobHandler({}, (error?: Error | null) =>
          error ? reject(error) : resolve(),
        );
      });
      sent.called.should.equal(false);
      jobs.length.should.equal(0);
    } finally {
      sinon.restore();
    }
  });

  it('Suppress reminder emails when recipient is suspended', function (done) {
    message.created = moment()
      .subtract(moment.duration({ minutes: 10, seconds: 1 }))
      .toDate();
    message
      .save()
      .then(function () {
        userTo.roles = ['user', 'suspended'];
        userTo
          .save()
          .then(function () {
            messageUnreadJobHandler({}, function (err?: Error | null) {
              if (err) return done(err);

              jobs.length.should.equal(0);
              Message.find({})
                .exec()
                .then(function (messages) {
                  required(
                    required(messages[0]).notificationCount,
                  ).should.equal(1);
                  done();
                })
                .catch(function (err) {
                  if (typeof done === 'function') return done(err);
                  throw err;
                });
            });
          })
          .catch(function (err) {
            if (typeof done === 'function') return done(err);
            throw err;
          });
      })
      .catch(err => done(err));
  });

  it('Ignore notification messages from removed users but do not stop processing other notifications', function (done) {
    const message2 = new Message(_message);
    message2.created = moment()
      .subtract(moment.duration({ minutes: 11 }))
      .toDate();

    // Attach non-existing user to this message
    message2.userFrom = new mongoose.Types.ObjectId();
    message2
      .save()
      .then(function () {
        message.created = moment()
          .subtract(moment.duration({ minutes: 10, seconds: 1 }))
          .toDate();
        message
          .save()
          .then(function () {
            messageUnreadJobHandler({}, function (err?: Error | null) {
              if (err) return done(err);

              jobs.length.should.equal(1);
              jobs[0].data.subject.should.equal(
                _userFrom.displayName + ' wrote you from Trustroots',
              );
              jobs[0].data.to.address.should.equal(_userTo.email);
              Message.find({})
                .exec()
                .then(function (messages) {
                  required(
                    required(messages[0]).notificationCount,
                  ).should.equal(1);
                  required(
                    required(messages[1]).notificationCount,
                  ).should.equal(1);
                  done();
                })
                .catch(function (err) {
                  if (typeof done === 'function') return done(err);
                  throw err;
                });
            });
          })
          .catch(function (err) {
            if (typeof done === 'function') return done(err);
            throw err;
          });
      })
      .catch(err => done(err));
  });

  context('messages straddling the reminder cutoff', function () {
    beforeEach(function () {
      sinon.useFakeTimers({ now: 1800000000000, toFake: ['Date'] });
    });

    afterEach(function () {
      sinon.restore();
    });

    function runJob(): Promise<void> {
      return new Promise((resolve, reject) => {
        messageUnreadJobHandler({}, error =>
          error ? reject(error) : resolve(),
        );
      });
    }

    it('waits for the newest pending message and sends the whole batch only once', async function () {
      message.created = moment().subtract({ minutes: 11 }).toDate();
      await message.save();
      const newer = await new Message({
        ..._message,
        created: moment().subtract({ minutes: 6 }).toDate(),
      }).save();

      await runJob();
      jobs.length.should.equal(0);
      required(
        (await Message.findById(message._id))?.notificationCount,
      ).should.equal(0);

      sinon.clock.tick(5 * 60 * 1000);
      await runJob();
      jobs.length.should.equal(1);
      for (const id of [message._id, newer._id]) {
        required((await Message.findById(id))?.notificationCount).should.equal(
          1,
        );
      }

      sinon.clock.tick(5 * 60 * 1000);
      await runJob();
      jobs.length.should.equal(1);
    });

    it('also groups staggered follow-up reminders', async function () {
      message.created = moment().subtract({ hours: 25 }).toDate();
      message.notificationCount = 1;
      await message.save();
      const newer = await new Message({
        ..._message,
        notificationCount: 1,
        created: moment().subtract({ hours: 23, minutes: 59 }).toDate(),
      }).save();

      await runJob();
      jobs.length.should.equal(0);
      sinon.clock.tick(2 * 60 * 1000);
      await runJob();
      jobs.length.should.equal(1);
      for (const id of [message._id, newer._id]) {
        required((await Message.findById(id))?.notificationCount).should.equal(
          2,
        );
      }
      await runJob();
      jobs.length.should.equal(1);
    });

    it('does not let read or already notified messages delay the first reminder', async function () {
      message.created = moment().subtract({ minutes: 11 }).toDate();
      await message.save();
      await Message.create([
        { ..._message, read: true, created: new Date() },
        { ..._message, notificationCount: 1, created: new Date() },
      ]);

      await runJob();
      jobs.length.should.equal(1);
      required(
        (await Message.findById(message._id))?.notificationCount,
      ).should.equal(1);
    });

    it('does not let fresh messages in another conversation delay a reminder', async function () {
      message.created = moment().subtract({ minutes: 11 }).toDate();
      await message.save();
      await new Message({
        ..._message,
        userFrom: userToId,
        userTo: userFromId,
        created: new Date(),
      }).save();

      await runJob();
      jobs.length.should.equal(1);
      jobs[0].data.to.address.should.equal(_userTo.email);
    });
  });

  context('further notifications configured', function () {
    // helpful function to convert readable (momentjs) duration to milliseconds
    function milliseconds(duration: moment.DurationInputArg1) {
      return moment.duration(duration).asMilliseconds();
    }

    beforeEach(function () {
      // Keep the system clock fixed. Only Date is faked so the job's
      // asynchronous queue can still finish.
      sinon.useFakeTimers({
        now: 1500000000000,
        toFake: ['Date'],
      });
    });

    // restore the original state
    afterEach(function () {
      sinon.restore();
    });

    it('Remind user again after a specified time.', function (done) {
      // update: message is created at the current time
      message.created = new Date();
      message
        .save()
        .then(function () {
          // wait for 10 minutes
          sinon.clock.tick(milliseconds({ minutes: 10, milliseconds: 1 }));

          messageUnreadJobHandler({}, function (err?: Error | null) {
            if (err) return done(err);

            // check that the first reminder is sent
            jobs.length.should.equal(1);

            // wait for 24 hours
            sinon.clock.tick(milliseconds({ hours: 23, minutes: 50 }));

            messageUnreadJobHandler({}, function (err?: Error | null) {
              if (err) return done(err);

              // check that the second reminder is sent
              jobs.length.should.equal(2);

              return done();
            });
          });
        })
        .catch(err => done(err));
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

      messageBefore
        .save()
        .then(function () {
          // wait a minute
          sinon.clock.tick(milliseconds({ minutes: 1 }));

          // update: message is created at the current time
          message.created = new Date();
          message
            .save()
            .then(function () {
              // wait for 10 minutes
              sinon.clock.tick(milliseconds({ minutes: 10, milliseconds: 1 }));

              messageUnreadJobHandler({}, function (err?: Error | null) {
                if (err) return done(err);

                // check that the first reminder is sent
                jobs.length.should.equal(1);

                // wait for 24 hours
                sinon.clock.tick(milliseconds({ hours: 23, minutes: 50 }));

                messageUnreadJobHandler({}, function (err?: Error | null) {
                  if (err) return done(err);

                  // check that the second reminder _is not_ sent
                  jobs.length.should.equal(1);

                  return done();
                });
              });
            })
            .catch(function (err) {
              if (typeof done === 'function') return done(err);
              throw err;
            });
        })
        .catch(err => done(err));
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

      messageBefore
        .save()
        .then(function () {
          // wait a minute
          sinon.clock.tick(milliseconds({ minutes: 1 }));

          // update: message is created at the current time
          message.created = new Date();
          message
            .save()
            .then(function () {
              // wait for 10 minutes
              sinon.clock.tick(milliseconds({ minutes: 10, milliseconds: 1 }));

              messageUnreadJobHandler({}, function (err?: Error | null) {
                if (err) return done(err);

                // check that the first reminder is sent
                jobs.length.should.equal(1);

                // wait for 24 hours
                sinon.clock.tick(milliseconds({ hours: 23, minutes: 50 }));

                messageUnreadJobHandler({}, function (err?: Error | null) {
                  if (err) return done(err);

                  // check that the second reminder _is_ sent
                  jobs.length.should.equal(2);

                  return done();
                });
              });
            })
            .catch(function (err) {
              if (typeof done === 'function') return done(err);
              throw err;
            });
        })
        .catch(err => done(err));
    });

    it('Let the further notification text be different from the first one.', function (done) {
      // update: message is created at the current time
      message.created = new Date();
      message
        .save()
        .then(function () {
          // wait for 10 minutes
          sinon.clock.tick(milliseconds({ minutes: 10, milliseconds: 1 }));

          messageUnreadJobHandler({}, function (err?: Error | null) {
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

            messageUnreadJobHandler({}, function (err?: Error | null) {
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
        })
        .catch(err => done(err));
    });

    it("When we didn't send the first notification on time for some erroneous reason, send just one; not two of them at the same time.", function (done) {
      // update: message is created at the current time
      message.created = new Date();
      message
        .save()
        .then(function () {
          // wait for 24 hours
          sinon.clock.tick(milliseconds({ hours: 24, milliseconds: 1 }));

          messageUnreadJobHandler({}, function (err?: Error | null) {
            if (err) return done(err);

            // check that the first reminder is sent
            jobs.length.should.equal(1);
            jobs[0].data.subject.should.equal(
              _userFrom.displayName + ' wrote you from Trustroots',
            );

            return done();
          });
        })
        .catch(err => done(err));
    });

    it("Don't send further notification about very old messages.", function (done) {
      // update: message is created at the current time
      message.created = new Date();
      message
        .save()
        .then(function () {
          // wait for 10 minutes
          sinon.clock.tick(milliseconds({ minutes: 10, milliseconds: 1 }));

          messageUnreadJobHandler({}, function (err?: Error | null) {
            if (err) return done(err);

            // check that the first reminder is sent
            jobs.length.should.equal(1);

            // wait for 14 days
            sinon.clock.tick(milliseconds({ days: 14 }));

            messageUnreadJobHandler({}, function (err?: Error | null) {
              if (err) return done(err);

              // check that the second reminder is not sent
              jobs.length.should.equal(1);

              return done();
            });
          });
        })
        .catch(err => done(err));
    });
  });

  describe('error handling branches', function () {
    afterEach(function () {
      sinon.restore();
    });

    it('limits delivery to five workers and waits for every delivery before updating counts', async function () {
      const notifications = Array.from({ length: 12 }, () => ({
        _id: { userTo: userToId, userFrom: userFromId },
        messages: [
          { id: message._id, content: 'Reminder', created: new Date() },
        ],
        notificationCount: 0,
      }));
      const aggregate = sinon.stub(Message, 'aggregate').resolves([]);
      aggregate.onFirstCall().resolves(notifications);
      sinon.stub(User, 'find').returns({
        exec: async () => [userFrom, userTo],
      } as unknown as ReturnType<typeof User.find>);
      sinon.stub(unifiedPush, 'notifyUnread').resolves();
      let active = 0;
      let maximum = 0;
      let completed = 0;
      sinon
        .stub(emailService, 'sendMessagesUnread')
        .callsFake((_, __, ___, callback) => {
          active++;
          maximum = Math.max(maximum, active);
          setImmediate(() => {
            active--;
            completed++;
            callback(
              completed === 1 ? new Error('Delivery failed') : undefined,
            );
          });
        });
      const update = sinon.stub(Message, 'updateMany').callsFake(() => {
        completed.should.equal(12);
        active.should.equal(0);
        return Promise.resolve() as unknown as ReturnType<
          typeof Message.updateMany
        >;
      });
      await new Promise<void>((resolve, reject) => {
        messageUnreadJobHandler({}, err => (err ? reject(err) : resolve()));
      });
      maximum.should.equal(5);
      update.callCount.should.equal(1);
    });

    it('logs the first queue error and completes after multiple task failures', function (done) {
      const jobWithQueueError = require('./../../../server/jobs/message-unread.server.job.mjs');
      const queueLog = sinon.stub(winston.Logger.prototype, 'log');
      const missingRecipientId = new mongoose.Types.ObjectId();

      sinon.stub(Message, 'aggregate').resolves([
        {
          _id: { userTo: missingRecipientId, userFrom: userFromId },
          messages: [
            { id: message._id, content: 'a message', created: new Date() },
          ],
          notificationCount: 0,
        },
        {
          _id: { userTo: userToId, userFrom: userFromId },
          messages: [
            { id: message._id, content: 'a message', created: new Date() },
          ],
          notificationCount: 0,
        },
      ]);
      const findUsers = sinon.stub(User, 'find');
      findUsers.returns({
        exec: () =>
          Promise.resolve([
            {
              _id: userFromId,
              email: _userFrom.email,
              displayName: _userFrom.displayName,
              roles: ['user'],
            },
            {
              _id: userToId,
              email: _userTo.email,
              displayName: _userTo.displayName,
              roles: ['user'],
            },
          ]),
      } as unknown as ReturnType<typeof findUsers>);
      const emailFailure = new Error('email failed');
      emailFailure.name = 'EmailDeliveryError';
      sinon
        .stub(emailService, 'sendMessagesUnread')
        .callsArgWith(3, emailFailure);
      sinon.stub(unifiedPush, 'notifyUnread').resolves();
      sinon.stub(Message, 'updateMany').resolves();

      jobWithQueueError({}, function (err?: Error | null) {
        if (err) return done(err);
        const queueErrorLog = queueLog
          .getCalls()
          .find(
            call =>
              call.args[1] ===
              'Sending unread message notifications caused an error. #j38vax',
          );
        if (!queueErrorLog) {
          return done(
            new Error('Expected unread notification queue error log'),
          );
        }
        const loggedArgs = queueErrorLog.args as unknown as unknown[];
        const loggedError = (loggedArgs[2] as { error: { name: string } })
          .error;
        loggedError.name.should.equal('Error');
        done();
      });
    });

    it('continues when notifications have no message ids', function (done) {
      const jobWithEmptyMessages = require('./../../../server/jobs/message-unread.server.job.mjs');
      sinon.stub(emailService, 'sendMessagesUnread').callsArg(3);

      sinon.stub(Message, 'aggregate').resolves([
        {
          _id: { userTo: userToId, userFrom: userFromId },
          messages: [],
          notificationCount: 0,
        },
      ]);
      const findUsers = sinon.stub(User, 'find');
      findUsers.returns({
        exec: () =>
          Promise.resolve([
            {
              _id: userFromId,
              email: _userFrom.email,
              displayName: _userFrom.displayName,
              roles: ['user'],
            },
            {
              _id: userToId,
              email: _userTo.email,
              displayName: _userTo.displayName,
              roles: ['user'],
            },
          ]),
      } as unknown as ReturnType<typeof findUsers>);
      sinon.stub(Message, 'updateMany').resolves();

      jobWithEmptyMessages({}, function (err?: Error | null) {
        if (err) return done(err);
        done();
      });
    });

    it('fails when marking messages as notified errors', function (done) {
      message.created = moment()
        .subtract(moment.duration({ minutes: 10, seconds: 1 }))
        .toDate();
      message
        .save()
        .then(function () {
          sinon.stub(Message, 'updateMany').rejects(new Error('update failed'));

          messageUnreadJobHandler({}, function (err?: Error | null) {
            if (!err) throw new Error('Expected update error');
            err.should.be.an.Error();
            err.message.should.equal('update failed');
            done();
          });
        })
        .catch(err => done(err));
    });
  });

  describe('reminder details', function () {
    const queueErrorMessage =
      'Sending unread message notifications caused an error. #j38vax';
    const config: {
      limits: {
        unreadMessageReminders: moment.DurationInputArg1[];
        unreadMessageRemindersTooLate: moment.DurationInputArg1;
      };
    } = require('./../../../../../config/config.mts');

    function ageMessage(minutes = 11) {
      message.created = moment().subtract({ minutes }).toDate();
      return message.save();
    }
    function runJob(): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        messageUnreadJobHandler({}, (error?: Error | null) =>
          error ? reject(error) : resolve(),
        );
      });
    }
    function logCalls(log: import('sinon').SinonStub, text: string) {
      return log.getCalls().filter(call => call.args[1] === text);
    }

    afterEach(function () {
      sinon.restore();
    });

    it('puts the unread message text into the reminder', async function () {
      message.content = 'Distinct reminder content';
      await ageMessage();
      await runJob();

      jobs.length.should.equal(1);
      (jobs[0].data as unknown as { text: string }).text.should.containEql(
        'Distinct reminder content',
      );
    });

    it('looks up only the members involved, with the fields the email needs', async function () {
      const find = sinon.spy(User, 'find');
      const log = sinon.stub(winston.Logger.prototype, 'log');
      await ageMessage();
      await runJob();

      find.calledOnce.should.equal(true);
      const [filter, projection] = find.firstCall.args as unknown as [
        { _id: { $in: unknown[] } },
        string,
      ];
      Object.keys(filter).should.deepEqual(['_id']);
      filter._id.$in
        .map(String)
        .sort()
        .should.deepEqual([String(userFromId), String(userToId)].sort());
      projection.should.equal('email displayName username roles');
      logCalls(log, queueErrorMessage).length.should.equal(0);
    });

    it('does no work when nothing is old enough to remind about', async function () {
      const find = sinon.spy(User, 'find');
      const update = sinon.spy(Message, 'updateMany');
      const log = sinon.stub(winston.Logger.prototype, 'log');
      await ageMessage(9);
      await runJob();

      find.called.should.equal(false);
      update.called.should.equal(false);
      log.called.should.equal(false);
      jobs.length.should.equal(0);
    });

    it('marks only the reminded messages as notified', async function () {
      await ageMessage();
      const reply = await new Message({
        userFrom: userToId,
        userTo: userFromId,
        content: 'A fresh reply',
        read: false,
        notificationCount: 0,
      }).save();
      await runJob();

      required(
        (await Message.findById(message._id))!.notificationCount,
      ).should.equal(1);
      required(
        (await Message.findById(reply._id))!.notificationCount,
      ).should.equal(0);
    });

    it('logs why a reminder was skipped for a removed member', async function () {
      const log = sinon.stub(winston.Logger.prototype, 'log');
      await ageMessage();
      await userFrom.deleteOne();
      await runJob();

      jobs.length.should.equal(0);
      const [entry] = logCalls(log, queueErrorMessage);
      required(entry);
      // Log redaction keeps only the error name, so a TypeError here would mean
      // the missing member was not caught by the explicit lookup check.
      (
        entry.args[2] as unknown as { error: { name: string } }
      ).error.name.should.equal('Error');
    });

    it('warns when a notification carries no message ids and updates nothing', async function () {
      const log = sinon.stub(winston.Logger.prototype, 'log');
      sinon.stub(emailService, 'sendMessagesUnread').callsArg(3);
      sinon.stub(Message, 'aggregate').resolves([
        {
          _id: { userTo: userToId, userFrom: userFromId },
          messages: [],
          notificationCount: 0,
        },
      ]);
      const update = sinon.stub(Message, 'updateMany').resolves();
      await runJob();

      update.called.should.equal(false);
      logCalls(
        log,
        'No messages to set notified. This probably should not happen. #hg38vs',
      )[0].args[0].should.equal('warn');
    });

    it('logs a failure to mark messages as notified', async function () {
      const log = sinon.stub(winston.Logger.prototype, 'log');
      const failure = new Error('update failed');
      await ageMessage();
      sinon.stub(Message, 'updateMany').rejects(failure);

      await runJob().then(
        () => {
          throw new Error('Expected the job to fail');
        },
        error => error.should.equal(failure),
      );

      const [entry] = logCalls(
        log,
        'Error while marking messages as notified. #9ehvbn',
      );
      required(entry).args[0].should.equal('error');
      (entry.args[2] as object).should.have.property('error');
    });

    it('logs a failed UnifiedPush delivery without failing the job', async function () {
      const log = sinon.stub(winston.Logger.prototype, 'log');
      sinon.stub(unifiedPush, 'notifyUnread').rejects(new Error('push down'));
      await ageMessage();
      await runJob();
      await new Promise<void>(resolve => setImmediate(resolve));

      const [entry] = logCalls(
        log,
        'UnifiedPush unread-message delivery failed.',
      );
      required(entry).args[0].should.equal('error');
      (entry.args[2] as object).should.have.property('error');
    });

    it('sends the first reminder after the shortest configured delay whatever the config order', async function () {
      sinon
        .stub(config.limits, 'unreadMessageReminders')
        .value([{ hours: 24 }, { minutes: 10 }]);
      await ageMessage();
      await runJob();

      jobs.length.should.equal(1);
      required(
        (await Message.findById(message._id))!.notificationCount,
      ).should.equal(1);
    });

    it('still sends a further reminder for a message exactly at the too-late limit', async function () {
      sinon.useFakeTimers({ now: 1500000000000, toFake: ['Date'] });
      const tooOld = moment()
        .subtract(moment.duration(config.limits.unreadMessageRemindersTooLate))
        .toDate();
      message.created = tooOld;
      message.notificationCount = 1;
      await message.save();
      await runJob();

      jobs.length.should.equal(1);
      jobs[0].data.subject.should.containEql('is still waiting for a reply');
    });

    it('pushes only with the first reminder', async function () {
      sinon.useFakeTimers({ now: 1500000000000, toFake: ['Date'] });
      const notifyUnread = sinon.stub(unifiedPush, 'notifyUnread').resolves();
      message.created = new Date();
      await message.save();

      sinon.clock.tick(
        moment.duration({ minutes: 10, milliseconds: 1 }).asMilliseconds(),
      );
      await runJob();
      jobs.length.should.equal(1);
      notifyUnread.callCount.should.equal(1);

      sinon.clock.tick(
        moment.duration({ hours: 23, minutes: 50 }).asMilliseconds(),
      );
      await runJob();
      jobs.length.should.equal(2);
      notifyUnread.callCount.should.equal(1);
    });
  });

  afterEach(async function () {
    await User.deleteMany();
    await Message.deleteMany();
    await Registration.deleteMany();
  });
});
