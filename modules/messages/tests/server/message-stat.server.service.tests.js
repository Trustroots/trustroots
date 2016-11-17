'use strict';

var path = require('path'),
    should = require('should'),
    async = require('async'),
    messageStatController = require(path.resolve(
      './modules/messages/server/services/message-stat.server.service')),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Message = mongoose.model('Message'),
    MessageStat = mongoose.model('MessageStat');

var initiator,
    receiver,
    firstMessage,
    firstReply,
    initiatorMessage,
    receiverMessage;

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
    // clean User, Message, MessageStat
    async.parallel([
      function (cb) {
        User.remove().exec(cb);
      },
      function (cb) {
        Message.remove().exec(cb);
      },
      function (cb) {
        MessageStat.remove().exec(cb);
      }
    ], done);
  });

  describe('updateMessageStat', function () {
    context('First message in Thread', function () {
      it('should create a new MessageStat document and respond `first`',
        function (done) {

          async.waterfall([
            // save the first message to database
            function (cb) {
              firstMessage.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // generate stats for the first message
            function (cb) {
              messageStatController.updateMessageStat(firstMessage, cb);
            },

            // check that the response is correct and find the MessageStat
            function (resp, cb) {
              try {
                resp.should.equal('first');

                MessageStat.findOne({
                  $or: [
                    {
                      firstMessageUserFrom: initiator._id,
                      firstMessageUserTo: receiver._id
                    },
                    {
                      firstMessageUserFrom: receiver._id,
                      firstMessageUserTo: initiator._id
                    }
                  ]
                }, cb);
              } catch (e) {
                cb(e);
              }
            },

            // check that the MessageStat is correct
            function (messageStat, cb) {
              var ms = messageStat;
              try {
                ms.should.have.property('firstMessageUserFrom', initiator._id);
                ms.should.have.property('firstMessageUserTo', receiver._id);
                ms.should.have.property('firstMessageCreated');
                ms.should.have.property('firstReplyCreated', null);
                return done();
              } catch (e) {
                if (e) return cb(e);
              }
            }
          ], done);

        });
    });

    context('First reply in Thread', function () {
      it('update the MessageStat with firstReply info & respond firstReply',
        function (done) {
          async.waterfall([

            // save the first message to database
            function (cb) {
              firstMessage.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // stats for the first message (preparation)
            function (cb) {
              messageStatController.updateMessageStat(firstMessage, cb);
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
              messageStatController.updateMessageStat(firstReply, cb);
            },

            function (resp, cb) {
              try {
                resp.should.equal('firstReply');

                MessageStat.findOne({
                  $or: [
                    {
                      firstMessageUserFrom: initiator._id,
                      firstMessageUserTo: receiver._id
                    },
                    {
                      firstMessageUserFrom: receiver._id,
                      firstMessageUserTo: initiator._id
                    }
                  ]
                }, cb);
              } catch (e) {
                cb(e);
              }
            },

            function (messageStat, cb) {
              var ms = messageStat;
              try {
                ms.should.have.property('firstMessageUserFrom', initiator._id);
                ms.should.have.property('firstMessageUserTo', receiver._id);
                ms.should.have.property('firstMessageCreated');
                ms.should.have.property('firstReplyCreated', firstReply.created);
                ms.should.have.property('firstReplyLength',
                  firstReply.content.length);
                ms.should.have.property('timeToFirstReply',
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
      it('[another message by the initiator before reply] should not change the MessageStat',
        function (done) {
          async.waterfall([

            // save the first message to database
            function (cb) {
              firstMessage.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // stats for the first message (preparation)
            function (cb) {
              messageStatController.updateMessageStat(firstMessage, cb);
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
              messageStatController.updateMessageStat(initiatorMessage, cb);
            },

            function (resp, cb) {
              try {
                resp.should.equal('other');

                MessageStat.findOne({
                  $or: [
                    {
                      firstMessageUserFrom: initiator._id,
                      firstMessageUserTo: receiver._id
                    },
                    {
                      firstMessageUserFrom: receiver._id,
                      firstMessageUserTo: initiator._id
                    }
                  ]
                }, cb);
              } catch (e) {
                cb(e);
              }
            },

            function (messageStat, cb) {
              var ts = messageStat;
              try {
                ts.should.have.property('firstMessageUserFrom', initiator._id);
                ts.should.have.property('firstMessageUserTo', receiver._id);
                ts.should.have.property('firstMessageCreated',
                  firstMessage.created);
                ts.should.have.property('firstReplyCreated', null);
                ts.should.have.property('firstReplyLength', null);
                ts.should.have.property('timeToFirstReply', null);
                return done();

              } catch (e) {
                if (e) return cb(e);
              }
            }

          ], done);
        });
      it('[another message by the initiator after reply] should not change the MessageStat',
        function (done) {
          async.waterfall([

            // save the first message to database (preparation)
            function (cb) {
              firstMessage.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // create stats for the first message (preparation)
            function (cb) {
              messageStatController.updateMessageStat(firstMessage, cb);
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
              messageStatController.updateMessageStat(firstReply, cb);
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
              messageStatController.updateMessageStat(initiatorMessage, cb);
            },

            // run tests
            function (resp, cb) {
              try {
                resp.should.equal('other');

                // find the MessageStat to run tests on it
                MessageStat.findOne({
                  $or: [
                    {
                      firstMessageUserFrom: initiator._id,
                      firstMessageUserTo: receiver._id
                    },
                    {
                      firstMessageUserFrom: receiver._id,
                      firstMessageUserTo: initiator._id
                    }
                  ]
                }, cb);
              } catch (e) {
                cb(e);
              }
            },

            function (messageStat, cb) {
              var ts = messageStat;
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

      it('[later message by the receiver] should not change the MessageStat',
        function (done) {
          async.waterfall([

            // save the first message to database (preparation)
            function (cb) {
              firstMessage.save(function (err) {
                if (err) return cb(err);
                cb();
              });
            },

            // stats for the first message (preparation)
            function (cb) {
              messageStatController.updateMessageStat(firstMessage, cb);
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
              messageStatController.updateMessageStat(firstReply, cb);
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
              messageStatController.updateMessageStat(receiverMessage, cb);
            },

            function (resp, cb) {
              try {
                resp.should.equal('other');

                MessageStat.findOne({
                  $or: [
                    {
                      firstMessageUserFrom: initiator._id,
                      firstMessageUserTo: receiver._id
                    },
                    {
                      firstMessageUserFrom: receiver._id,
                      firstMessageUserTo: initiator._id
                    }
                  ]
                }, cb);
              } catch (e) {
                cb(e);
              }
            },

            function (messageStat, cb) {
              var ts = messageStat;
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

    context('It is the firstReply, but MessageStat doesn\'t exist', function () {
      it('should respond `firstReply`',
        function (done) {
          async.waterfall([

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
              messageStatController.updateMessageStat(firstReply, cb);
            },

            function (resp, cb) {
              try {
                resp.should.equal('firstReply');

                MessageStat.findOne({
                  $or: [
                    {
                      firstMessageUserFrom: initiator._id,
                      firstMessageUserTo: receiver._id
                    },
                    {
                      firstMessageUserFrom: receiver._id,
                      firstMessageUserTo: initiator._id
                    }
                  ]
                }, cb);
              } catch (e) {
                cb(e);
              }
            },

            function (messageStat, cb) {
              var ts = messageStat;
              try {
                should(ts).not.equal(null);
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
