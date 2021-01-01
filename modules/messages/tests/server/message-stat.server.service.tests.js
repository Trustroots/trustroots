const path = require('path');
const should = require('should');
const async = require('async');
const mongoose = require('mongoose');
const messageStatService = require(path.resolve(
  './modules/messages/server/services/message-stat.server.service',
));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

const User = mongoose.model('User');
const Message = mongoose.model('Message');
const MessageStat = mongoose.model('MessageStat');

let initiator;
let receiver;
let firstMessage;
let firstReply;
let initiatorMessage;
let receiverMessage;

describe('Convert Message Statistics to human readable form', function () {
  it('should convert null values correctly', function () {
    const converted = messageStatService.formatStats({
      replyRate: null,
      replyTime: null,
    });

    converted.should.have.property('replyRate', '');
    converted.should.have.property('replyTime', '');
  });

  it('should convert finite values correctly', function () {
    const converted = messageStatService.formatStats({
      replyRate: 0.37631,
      replyTime: 3600 * 1000 * 3.7,
    });

    converted.should.have.property('replyRate', '38%');
    converted.should.have.property('replyTime', '4 hours');
  });
});

describe('Count Message Statistics of User', function () {
  const NOW = new Date('2002-02-20').getTime(); // an arbitrary date
  const DAY = 24 * 3600 * 1000; // a length of a day in milliseconds
  const messageStats = [];
  const users = [];

  // create testing users
  before(function (done) {
    for (let i = 0; i < 29; ++i) {
      users.push(
        new User({
          firstName: 'firstName',
          lastName: 'lastName',
          displayName: 'displayName',
          email: 'user' + i + '@example.com',
          username: 'username' + i,
          password: 'password123',
          provider: 'local',
          public: true,
        }),
      );
    }

    // Save the users to database
    async.each(
      users,
      function (user, callback) {
        user.save(callback);
      },
      done,
    );
  });

  // create testing messageStats
  before(function (done) {
    // every thread is initiated by different user (user 0 is the receiver of all)

    let userno = 1; // the index of user who sent the first message
    // is incremented for every message, closure

    /**
     * DRYing generating the messageStats
     * @param {number} count - amount of messageStats to create
     * @param {number} count - amount of messageStats which are replied
     * @param {number} replyTime - timeToFirstReply for messageStats [millisecond]
     * @param {timeNow} number - minimum timestamp of the firstMessageCreated
     */
    function generateMessageStats(count, repliedCount, replyTime, timeNow) {
      for (let i = 0; i < count; ++i) {
        const firstCreated = timeNow - replyTime - (i + 1) * DAY;
        messageStats.push(
          new MessageStat({
            firstMessageUserFrom: users[userno]._id,
            firstMessageUserTo: users[0]._id,
            firstMessageCreated: new Date(firstCreated),
            firstMessageLength: 100,
            firstReplyCreated:
              i < repliedCount ? new Date(firstCreated + replyTime) : null,
            firstReplyLength: i < repliedCount ? 50 : null,
            timeToFirstReply: i < repliedCount ? replyTime : null,
          }),
        );
        // increment the userFrom
        ++userno;
      }
    }

    // 12 messages within last 0 - 30 days (6 of them replied within 2 days)
    generateMessageStats(12, 6, 2 * DAY, NOW);
    // + 8 msg within last 30 - 60 days (2 replied within 1 day)
    generateMessageStats(8, 2, 1 * DAY, NOW - 30 * DAY);
    // + 4 msg within last 60 - 90 days (3 replied within 3 days)
    generateMessageStats(4, 3, 3 * DAY, NOW - 60 * DAY);
    // + 4 msg within last 90 - 120 days (0 replied)
    generateMessageStats(4, 0, 1 * DAY, NOW - 90 * DAY);

    // Save the messageStats to database
    async.each(
      messageStats,
      function (messageStat, callback) {
        messageStat.save(callback);
      },
      done,
    );
  });

  after(utils.clearDatabase);

  it('[< 10 messages in last 90 days] should use 90 days', function (done) {
    messageStatService.readMessageStatsOfUser(
      users[0]._id,
      NOW - 60 * DAY,
      function (err, stats) {
        if (err) return done(err);
        try {
          should(stats).have.property('replyRate', 3 / 8);
          should(stats).have.property('replyTime', 3 * DAY);
          return done();
        } catch (e) {
          return done(e);
        }
      },
    );
  });

  it('[< 10 messages in last 30 days && > 10 in 90 d] should use last 10 messages', function (done) {
    messageStatService.readMessageStatsOfUser(
      users[0]._id,
      NOW - 30 * DAY,
      function (err, stats) {
        // expected statistics values
        // out of last 10 messages, 4 are replied;
        // 2 replied within 3 days and 2 within 1 day
        const expectedReplyRate = 4 / 10;
        const expectedReplyTime = (2 * 3 * DAY + 2 * 1 * DAY) / 4;

        if (err) return done(err);
        try {
          should(stats).have.property('replyRate', expectedReplyRate);
          should(stats).have.property('replyTime', expectedReplyTime);
          return done();
        } catch (e) {
          return done(e);
        }
      },
    );
  });

  it('[> 10 messages in last 30 days] should use last 30 days', function (done) {
    messageStatService.readMessageStatsOfUser(
      users[0]._id,
      NOW,
      function (err, stats) {
        // expected statistics values
        // out of last month 6/12 messages are replied; all within 2 days
        const expectedReplyRate = 6 / 12;
        const expectedReplyTime = 2 * DAY;

        if (err) return done(err);
        try {
          should(stats).have.property('replyRate', expectedReplyRate);
          should(stats).have.property('replyTime', expectedReplyTime);
          return done();
        } catch (e) {
          return done(e);
        }
      },
    );
  });

  it('[no messages] reply rate and time should be null', function (done) {
    messageStatService.readMessageStatsOfUser(
      users[0]._id,
      NOW - 120 * DAY,
      function (err, stats) {
        if (err) return done(err);
        try {
          should(stats).have.property('replyRate', null);
          should(stats).have.property('replyTime', null);
          return done();
        } catch (e) {
          return done(e);
        }
      },
    );
  });

  it('[no replied messages] reply rate should be 0 and reply time null', function (done) {
    messageStatService.readMessageStatsOfUser(
      users[0]._id,
      NOW - 90 * DAY,
      function (err, stats) {
        if (err) return done(err);
        try {
          should(stats).have.property('replyRate', 0);
          should(stats).have.property('replyTime', null);
          return done();
        } catch (e) {
          return done(e);
        }
      },
    );
  });

  it('[some replied messages] reply rate and time should be a number', function (done) {
    messageStatService.readMessageStatsOfUser(
      users[0]._id,
      NOW - 30 * DAY,
      function (err, stats) {
        if (err) return done(err);
        try {
          should(stats).have.property('replyRate');
          should(stats).have.property('replyTime');
          should(stats.replyRate).be.Number();
          should(stats.replyTime).be.Number();
          return done();
        } catch (e) {
          return done(e);
        }
      },
    );
  });
});

describe('MessageStat Creation & Updating Test', function () {
  beforeEach(function () {
    // create means create without saving to database, unless explicit
    // create the initiator (User)
    initiator = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'user1@test.com',
      username: 'username1',
      password: 'password123',
      provider: 'local',
      public: true,
    });

    // create the receiver (User)
    receiver = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'user2@test.com',
      username: 'username2',
      password: 'password123',
      provider: 'local',
      public: true,
    });

    // create a first message
    firstMessage = new Message({
      content: 'Message content',
      userFrom: initiator._id,
      userTo: receiver._id,
      created: new Date('2016-01-01'),
    });
    // create a first reply
    firstReply = new Message({
      content: 'Message content',
      userFrom: receiver._id,
      userTo: initiator._id,
      created: new Date('2016-01-02'),
    });

    // create a message by initiator
    initiatorMessage = new Message({
      content: 'Message content',
      userFrom: initiator._id,
      userTo: receiver._id,
      created: new Date('2016-01-03'),
    });
    // create a message by receiver
    receiverMessage = new Message({
      content: 'Message content',
      userFrom: receiver._id,
      userTo: initiator._id,
      created: new Date('2016-01-04'),
    });
  });

  afterEach(utils.clearDatabase);

  describe('updateMessageStat', function () {
    context('First message in Thread', function () {
      it('should create a new MessageStat document and respond `first`', function (done) {
        async.waterfall(
          [
            // save the first message to database
            function (cb) {
              firstMessage.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // generate stats for the first message
            function (cb) {
              messageStatService.updateMessageStat(firstMessage, cb);
            },

            // check that the response is correct and find the MessageStat
            function (resp, cb) {
              try {
                resp.should.equal('first');

                MessageStat.findOne(
                  {
                    $or: [
                      {
                        firstMessageUserFrom: initiator._id,
                        firstMessageUserTo: receiver._id,
                      },
                      {
                        firstMessageUserFrom: receiver._id,
                        firstMessageUserTo: initiator._id,
                      },
                    ],
                  },
                  cb,
                );
              } catch (e) {
                cb(e);
              }
            },

            // check that the MessageStat is correct
            function (messageStat, cb) {
              const ms = messageStat;
              try {
                ms.should.have.property('firstMessageUserFrom', initiator._id);
                ms.should.have.property('firstMessageUserTo', receiver._id);
                ms.should.have.property('firstMessageCreated');
                ms.should.have.property('firstReplyCreated', null);
                return done();
              } catch (e) {
                if (e) return cb(e);
              }
            },
          ],
          done,
        );
      });
    });

    context('First reply in Thread', function () {
      it('update the MessageStat with firstReply info & respond firstReply', function (done) {
        async.waterfall(
          [
            // save the first message to database
            function (cb) {
              firstMessage.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // stats for the first message (preparation)
            function (cb) {
              messageStatService.updateMessageStat(firstMessage, cb);
            },

            // save the first reply to database
            function (resp, cb) {
              firstReply.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // stats for the first reply
            function (cb) {
              messageStatService.updateMessageStat(firstReply, cb);
            },

            function (resp, cb) {
              try {
                resp.should.equal('firstReply');

                MessageStat.findOne(
                  {
                    $or: [
                      {
                        firstMessageUserFrom: initiator._id,
                        firstMessageUserTo: receiver._id,
                      },
                      {
                        firstMessageUserFrom: receiver._id,
                        firstMessageUserTo: initiator._id,
                      },
                    ],
                  },
                  cb,
                );
              } catch (e) {
                cb(e);
              }
            },

            function (messageStat, cb) {
              const ms = messageStat;
              try {
                ms.should.have.property('firstMessageUserFrom', initiator._id);
                ms.should.have.property('firstMessageUserTo', receiver._id);
                ms.should.have.property('firstMessageCreated');
                ms.should.have.property(
                  'firstReplyCreated',
                  firstReply.created,
                );
                ms.should.have.property(
                  'firstReplyLength',
                  firstReply.content.length,
                );
                ms.should.have.property(
                  'timeToFirstReply',
                  firstReply.created.getTime() - firstMessage.created.getTime(),
                );
                return done();
              } catch (e) {
                if (e) return cb(e);
              }
            },
          ],
          done,
        );
      });
    });

    context('Other messages in Thread', function () {
      it('[another message by the initiator before reply] should not change the MessageStat', function (done) {
        async.waterfall(
          [
            // save the first message to database
            function (cb) {
              firstMessage.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // stats for the first message (preparation)
            function (cb) {
              messageStatService.updateMessageStat(firstMessage, cb);
            },

            // save the first message to database
            function (resp, cb) {
              initiatorMessage.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // stats for the second message
            function (cb) {
              messageStatService.updateMessageStat(initiatorMessage, cb);
            },

            function (resp, cb) {
              try {
                resp.should.equal('other');

                MessageStat.findOne(
                  {
                    $or: [
                      {
                        firstMessageUserFrom: initiator._id,
                        firstMessageUserTo: receiver._id,
                      },
                      {
                        firstMessageUserFrom: receiver._id,
                        firstMessageUserTo: initiator._id,
                      },
                    ],
                  },
                  cb,
                );
              } catch (e) {
                cb(e);
              }
            },

            function (messageStat, cb) {
              const ts = messageStat;
              try {
                ts.should.have.property('firstMessageUserFrom', initiator._id);
                ts.should.have.property('firstMessageUserTo', receiver._id);
                ts.should.have.property(
                  'firstMessageCreated',
                  firstMessage.created,
                );
                ts.should.have.property('firstReplyCreated', null);
                ts.should.have.property('firstReplyLength', null);
                ts.should.have.property('timeToFirstReply', null);
                return done();
              } catch (e) {
                if (e) return cb(e);
              }
            },
          ],
          done,
        );
      });
      it('[another message by the initiator after reply] should not change the MessageStat', function (done) {
        async.waterfall(
          [
            // save the first message to database (preparation)
            function (cb) {
              firstMessage.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // create stats for the first message (preparation)
            function (cb) {
              messageStatService.updateMessageStat(firstMessage, cb);
            },

            // save the first reply
            function (resp, cb) {
              firstReply.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // update stats for the first reply
            function (cb) {
              messageStatService.updateMessageStat(firstReply, cb);
            },

            // save another initiator message
            function (resp, cb) {
              firstReply.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // update stats with another initiator's message
            function (cb) {
              messageStatService.updateMessageStat(initiatorMessage, cb);
            },

            // run tests
            function (resp, cb) {
              try {
                resp.should.equal('other');

                // find the MessageStat to run tests on it
                MessageStat.findOne(
                  {
                    $or: [
                      {
                        firstMessageUserFrom: initiator._id,
                        firstMessageUserTo: receiver._id,
                      },
                      {
                        firstMessageUserFrom: receiver._id,
                        firstMessageUserTo: initiator._id,
                      },
                    ],
                  },
                  cb,
                );
              } catch (e) {
                cb(e);
              }
            },

            function (messageStat, cb) {
              const ts = messageStat;
              try {
                ts.should.have.property('firstMessageUserFrom', initiator._id);
                ts.should.have.property('firstMessageUserTo', receiver._id);
                ts.should.have.property(
                  'firstMessageCreated',
                  firstMessage.created,
                );
                ts.should.have.property(
                  'firstReplyCreated',
                  firstReply.created,
                );
                return done();
              } catch (e) {
                if (e) return cb(e);
              }
            },
          ],
          done,
        );
      });

      it('[later message by the receiver] should not change the MessageStat', function (done) {
        async.waterfall(
          [
            // save the first message to database (preparation)
            function (cb) {
              firstMessage.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // stats for the first message (preparation)
            function (cb) {
              messageStatService.updateMessageStat(firstMessage, cb);
            },

            // save the first reply
            function (resp, cb) {
              firstReply.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // stats for the first reply
            function (cb) {
              messageStatService.updateMessageStat(firstReply, cb);
            },

            // save the further receiver's message
            function (resp, cb) {
              receiverMessage.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // stats for the further receiver's message
            function (cb) {
              messageStatService.updateMessageStat(receiverMessage, cb);
            },

            function (resp, cb) {
              try {
                resp.should.equal('other');

                MessageStat.findOne(
                  {
                    $or: [
                      {
                        firstMessageUserFrom: initiator._id,
                        firstMessageUserTo: receiver._id,
                      },
                      {
                        firstMessageUserFrom: receiver._id,
                        firstMessageUserTo: initiator._id,
                      },
                    ],
                  },
                  cb,
                );
              } catch (e) {
                cb(e);
              }
            },

            function (messageStat, cb) {
              const ts = messageStat;
              try {
                ts.should.have.property('firstMessageUserFrom', initiator._id);
                ts.should.have.property('firstMessageUserTo', receiver._id);
                ts.should.have.property(
                  'firstMessageCreated',
                  firstMessage.created,
                );
                ts.should.have.property(
                  'firstReplyCreated',
                  firstReply.created,
                );
                return done();
              } catch (e) {
                if (e) return cb(e);
              }
            },
          ],
          done,
        );
      });
    });

    context("It is the firstReply, but MessageStat doesn't exist", function () {
      it('should respond `firstReply`', function (done) {
        async.waterfall(
          [
            // save the first message to database
            function (cb) {
              firstMessage.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // save the first reply to database
            function (cb) {
              firstReply.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // stats for the further receiver's message
            function (cb) {
              messageStatService.updateMessageStat(firstReply, cb);
            },

            function (resp, cb) {
              try {
                resp.should.equal('firstReply');

                MessageStat.findOne(
                  {
                    $or: [
                      {
                        firstMessageUserFrom: initiator._id,
                        firstMessageUserTo: receiver._id,
                      },
                      {
                        firstMessageUserFrom: receiver._id,
                        firstMessageUserTo: initiator._id,
                      },
                    ],
                  },
                  cb,
                );
              } catch (e) {
                cb(e);
              }
            },

            function (messageStat, cb) {
              const ts = messageStat;
              try {
                should(ts).not.equal(null);
                return done();
              } catch (e) {
                if (e) return cb(e);
              }
            },
          ],
          done,
        );
      });
    });
  });
});
