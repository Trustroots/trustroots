'use strict';

var path = require('path'),
    should = require('should'),
    async = require('async'),
    threadStatController = require(path.resolve(
      './modules/messages/server/controllers/thread-stat.server.controller')),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Message = mongoose.model('Message'),
    Thread = mongoose.model('Thread'),
    ThreadStat = mongoose.model('ThreadStat');

var initiator,
    receiver,
    firstMessage,
    firstReply,
    initiatorMessage,
    receiverMessage;

describe('ThreadStat Creation & Updating Test', function () {
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
      public: true
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
      public: true
    });

    // create a first message
    firstMessage = new Message({
      content: 'Message content',
      userFrom: initiator._id,
      userTo: receiver._id,
      created: new Date('2016-01-01')
    });
    // create a first reply
    firstReply = new Message({
      content: 'Message content',
      userFrom: receiver._id,
      userTo: initiator._id,
      created: new Date('2016-01-02')
    });

    // create a message by initiator
    initiatorMessage = new Message({
      content: 'Message content',
      userFrom: initiator._id,
      userTo: receiver._id,
      created: new Date('2016-01-03')
    });
    // create a message by receiver
    receiverMessage = new Message({
      content: 'Message content',
      userFrom: receiver._id,
      userTo: initiator._id,
      created: new Date('2016-01-04')
    });
  });

  afterEach(function (done) {
    // TODO clean the database
    // clean User, Message, Thread, ThreadStat
    async.parallel([
      function (cb) {
        User.remove().exec(cb);
      },
      function (cb) {
        Message.remove().exec(cb);
      },
      function (cb) {
        Thread.remove().exec(cb);
      },
      function (cb) {
        ThreadStat.remove().exec(cb);
      }
    ], done);
  });

  describe('updateThreadStat', function () {
    context('First message in Thread', function () {
      it('should create a new ThreadStat document and respond `first`',
        function (done) {
          // create the thread
          var thread = new Thread({
            userFrom: initiator._id,
            userTo: receiver._id,
            message: firstMessage._id
          });

          threadStatController.updateThreadStat(thread, firstMessage,
            function (err, response) {
              if (err) {
                return done(err);
              }

              try {
                response.should.equal('first');
                ThreadStat.findOne({ thread: thread._id }, function (err, resp) {
                  if (err) {
                    return done(err);
                  }

                  try {
                    resp.should.have.property('firstMessageUserFrom',
                      initiator._id);
                    resp.should.have.property('firstMessageUserTo', receiver._id);
                    resp.should.have.property('firstMessageCreated');
                    resp.should.have.property('firstReplyCreated', null);
                    return done();
                  } catch (e) {
                    return done(e);
                  }
                });
              } catch (e) {
                return done(e);
              }
            });
        });
    });

    context('First reply in Thread', function () {
      it('update the ThreadStat with firstReply info & respond firstReply',
        function (done) {
          var thread = new Thread({
            userFrom: initiator._id,
            userTo: receiver._id,
            message: firstMessage._id
          });

          async.waterfall([

            // stats for the first message (preparation)
            function (cb) {
              threadStatController.updateThreadStat(thread, firstMessage, cb);
            },

            // save the first message to database
            function (resp, cb) {
              firstMessage.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // stats for the first reply
            function (cb) {
              threadStatController.updateThreadStat(thread, firstReply, cb);
            },

            function (resp, cb) {
              try {
                resp.should.equal('firstReply');

                ThreadStat.findOne({ thread: thread._id }, cb);
              } catch (e) {
                cb(e);
              }
            },

            function (threadStat, cb) {
              var ts = threadStat;
              try {
                ts.should.have.property('firstMessageUserFrom', initiator._id);
                ts.should.have.property('firstMessageUserTo', receiver._id);
                ts.should.have.property('firstMessageCreated');
                ts.should.have.property('firstReplyCreated', firstReply.created);
                ts.should.have.property('firstReplyLength',
                  firstReply.content.length);
                ts.should.have.property('firstReplyTime',
                  firstReply.created.getTime() - firstMessage.created.getTime());
                return done();

              } catch (e) {
                if (e) return cb(e);
              }
            }

          ], done);
        });
    });

    context('Other messages in Thread', function () {
      it('[another message by the initiator before reply] should not change the ThreadStat',
        function (done) {
          var thread = new Thread({
            userFrom: initiator._id,
            userTo: receiver._id,
            message: firstMessage._id
          });

          async.waterfall([

            // stats for the first message (preparation)
            function (cb) {
              threadStatController.updateThreadStat(thread, firstMessage, cb);
            },

            // save the first message to database
            function (resp, cb) {
              firstMessage.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // stats for the first reply
            function (cb) {
              threadStatController.updateThreadStat(thread, initiatorMessage, cb);
            },

            function (resp, cb) {
              try {
                resp.should.equal('other');

                ThreadStat.findOne({ thread: thread._id }, cb);
              } catch (e) {
                cb(e);
              }
            },

            function (threadStat, cb) {
              var ts = threadStat;
              try {
                ts.should.have.property('firstMessageUserFrom', initiator._id);
                ts.should.have.property('firstMessageUserTo', receiver._id);
                ts.should.have.property('firstMessageCreated',
                  firstMessage.created);
                ts.should.have.property('firstReplyCreated', null);
                ts.should.have.property('firstReplyLength', null);
                ts.should.have.property('firstReplyTime', null);
                return done();

              } catch (e) {
                if (e) return cb(e);
              }
            }

          ], done);
        });
      it('[another message by the initiator after reply] should not change the ThreadStat',
        function (done) {
          var thread = new Thread({
            userFrom: initiator._id,
            userTo: receiver._id,
            message: firstMessage._id
          });

          async.waterfall([

            // create stats for the first message (preparation)
            function (cb) {
              threadStatController.updateThreadStat(thread, firstMessage, cb);
            },

            // save the first message to database (preparation)
            function (resp, cb) {
              firstMessage.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // update stats for the first reply
            function (cb) {
              threadStatController.updateThreadStat(thread, firstReply, cb);
            },

            // save the first reply
            function (resp, cb) {
              firstReply.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // update stats with the further initiator's message
            function (cb) {
              threadStatController.updateThreadStat(thread, initiatorMessage, cb);
            },

            // run tests
            function (resp, cb) {
              try {
                resp.should.equal('other');

                // find the ThreadStat to run tests on it
                ThreadStat.findOne({ thread: thread._id }, cb);
              } catch (e) {
                cb(e);
              }
            },

            function (threadStat, cb) {
              var ts = threadStat;
              try {
                ts.should.have.property('firstMessageUserFrom', initiator._id);
                ts.should.have.property('firstMessageUserTo', receiver._id);
                ts.should.have.property('firstMessageCreated',
                  firstMessage.created);
                ts.should.have.property('firstReplyCreated', firstReply.created);
                return done();

              } catch (e) {
                if (e) return cb(e);
              }
            }

          ], done);
        });
      it('[later message by the receiver] should not change the ThreadStat',
        function (done) {
          var thread = new Thread({
            userFrom: initiator._id,
            userTo: receiver._id,
            message: firstMessage._id
          });

          async.waterfall([

            // stats for the first message (preparation)
            function (cb) {
              threadStatController.updateThreadStat(thread, firstMessage, cb);
            },

            // save the first message to database (preparation)
            function (resp, cb) {
              firstMessage.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // stats for the first reply
            function (cb) {
              threadStatController.updateThreadStat(thread, firstReply, cb);
            },

            // save the first reply
            function (resp, cb) {
              firstReply.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // stats for the further replier's message
            function (cb) {
              threadStatController.updateThreadStat(thread, receiverMessage, cb);
            },

            function (resp, cb) {
              try {
                resp.should.equal('other');

                ThreadStat.findOne({ thread: thread._id }, cb);
              } catch (e) {
                cb(e);
              }
            },

            function (threadStat, cb) {
              var ts = threadStat;
              try {
                ts.should.have.property('firstMessageUserFrom', initiator._id);
                ts.should.have.property('firstMessageUserTo', receiver._id);
                ts.should.have.property('firstMessageCreated',
                  firstMessage.created);
                ts.should.have.property('firstReplyCreated', firstReply.created);
                return done();

              } catch (e) {
                if (e) return cb(e);
              }
            }

          ], done);
        });
    });

    context('Other messages exist but the ThreadStat doesn\'t', function () {
      it('should respond `historic` and do nothing',
        function (done) {
          var thread = new Thread({
            userFrom: initiator._id,
            userTo: receiver._id,
            message: firstMessage._id
          });

          async.waterfall([

            // save the first message to database
            function (cb) {
              firstMessage.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // stats for the further receiver's message
            function (cb) {
              threadStatController.updateThreadStat(thread, firstReply, cb);
            },

            function (resp, cb) {
              try {
                resp.should.equal('historic');

                ThreadStat.findOne({ thread: thread._id }, cb);
              } catch (e) {
                cb(e);
              }
            },

            function (threadStat, cb) {
              var ts = threadStat;
              try {
                should(ts).equal(null);
                return done();

              } catch (e) {
                if (e) return cb(e);
              }
            }

          ], done);
        });
    });
  });
});
