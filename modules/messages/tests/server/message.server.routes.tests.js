const _ = require('lodash');
const should = require('should');
const async = require('async');
const request = require('supertest');
const path = require('path');
const moment = require('moment');
const mongoose = require('mongoose');
const config = require(path.resolve('./config/config'));
const express = require(path.resolve('./config/lib/express'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

const User = mongoose.model('User');
const Message = mongoose.model('Message');
const Thread = mongoose.model('Thread');

/**
 * Globals
 */
let app;
let agent;
let credentials;
let userFrom;
let userTo;
let userFromId;
let userToId;
let message;

/**
 * Message routes tests
 */
describe('Message CRUD tests', function () {
  before(function (done) {
    // Get application
    app = express.init(mongoose.connection);
    agent = request.agent(app);

    done();
  });

  beforeEach(function (done) {
    // Create userFrom credentials
    credentials = {
      username: 'username1',
      password: 'password123',
    };

    // Create a new user
    userFrom = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test1@test.com',
      username: credentials.username,
      password: credentials.password,
      provider: 'local',
      roles: ['user'],
      description: _.repeat('.', config.profileMinimumLength),
      public: true,
    });

    userTo = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test2@test.com',
      username: 'username2',
      password: 'password123',
      provider: 'local',
      roles: ['user'],
      description: _.repeat('.', config.profileMinimumLength),
      public: true,
    });

    // Save users to the test db and create new message
    userFrom.save(function (userFromErr, userFromRes) {
      should.not.exist(userFromErr);
      userFromId = userFromRes._id;
      userTo.save(function (userToErr, userToRes) {
        should.not.exist(userToErr);
        userToId = userToRes._id;
        // Create message
        message = {
          content: 'Message content',
          userTo: userToId,
        };
        return done();
      });
    });
  });

  afterEach(utils.clearDatabase);

  it('should not be able to read inbox if not logged in', function (done) {
    agent
      .get('/api/messages')
      .expect(403)
      .end(function (messageSaveErr, messageSaveRes) {
        messageSaveRes.body.message.should.equal('Forbidden.');

        // Call the assertion callback
        return done(messageSaveErr);
      });
  });

  it('should not be able to send message if not logged in', function (done) {
    agent
      .post('/api/messages')
      .send(message)
      .expect(403)
      .end(function (messageSaveErr, messageSaveRes) {
        messageSaveRes.body.message.should.equal('Forbidden.');

        // Call the assertion callback
        return done(messageSaveErr);
      });
  });

  it('should be able to send and read messages if logged in', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr, signinRes) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Get user id
        const userFromId = signinRes.body._id;

        // Save a new message
        agent
          .post('/api/messages')
          .send(message)
          .expect(200)
          .end(function (messageSaveErr) {
            // Handle message save error
            if (messageSaveErr) return done(messageSaveErr);

            // Get a list of messages
            agent
              .get('/api/messages/' + userToId)
              .expect(200)
              .end(function (messagesGetErr, messagesGetRes) {
                // Handle message get error
                if (messagesGetErr) return done(messagesGetErr);

                // Get messages list
                const thread = messagesGetRes.body;

                if (!thread[0] || !thread[0].content) {
                  return done(
                    new Error('Missing messages from the message thread.'),
                  );
                } else {
                  // Set assertions
                  thread[0].userFrom._id.should.equal(userFromId.toString());
                  thread[0].userTo._id.should.equal(userToId.toString());
                  thread[0].content.should.equal('Message content');
                  thread[0].read.should.equal(false);
                  should.not.exist(thread[0].notified);

                  // Call the assertion callback
                  return done();
                }
              });
          });
      });
  });

  it('should be able to send and read messages when with role "shadowban"', function (done) {
    userFrom.roles = ['user', 'shadowban'];

    userFrom.save(function (saveErr) {
      should.not.exist(saveErr);

      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          should.not.exist(signinErr);

          // Save a new message
          agent
            .post('/api/messages')
            .send(message)
            .expect(200)
            .end(function (messageSaveErr) {
              should.not.exist(messageSaveErr);

              // Get a list of messages
              agent
                .get('/api/messages/' + userToId)
                .expect(200)
                .end(function (messagesGetErr, messagesGetRes) {
                  should.not.exist(messagesGetErr);

                  // Confirm message is on the list
                  if (
                    !messagesGetRes.body[0] ||
                    !messagesGetRes.body[0].content
                  ) {
                    return done(new Error('Message list empty.'));
                  }

                  done();
                });
            });
        });
    });
  });

  it('should be able to read messages from user with role "shadowban"', function (done) {
    userTo.roles = ['user', 'shadowban'];

    userTo.save(function (saveErr) {
      should.not.exist(saveErr);

      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          should.not.exist(signinErr);

          // Get a list of messages
          agent
            .get('/api/messages/' + userToId)
            .expect(200)
            .end(done);
        });
    });
  });

  it('should not be able to send messages to user with role "shadowban"', function (done) {
    userTo.roles = ['user', 'shadowban'];

    userTo.save(function (saveErr) {
      should.not.exist(saveErr);

      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          should.not.exist(signinErr);

          // Save a new message
          agent.post('/api/messages').send(message).expect(404).end(done);
        });
    });
  });

  ['admin', 'moderator'].forEach(role => {
    it(`should be able to send messages to user with role "shadowban" when with role "${role}"`, function (done) {
      userTo.roles = ['user', 'shadowban'];
      userFrom.roles = ['user', role];

      userFrom.save(function (saveErr) {
        should.not.exist(saveErr);

        userTo.save(function (saveErr) {
          should.not.exist(saveErr);

          agent
            .post('/api/auth/signin')
            .send(credentials)
            .expect(200)
            .end(function (signinErr) {
              should.not.exist(signinErr);

              // Save a new message
              agent.post('/api/messages').send(message).expect(200).end(done);
            });
        });
      });
    });
  });

  it('should be able to send basic correctly formatted html in an message', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Create html in message
        const htmlMessage = message;
        htmlMessage.content =
          '<p>' +
          '<b>bold</b><br />' +
          '<i>italic</i><br />' +
          '<u>underline</u><br />' +
          '</p>' +
          '<blockquote>blockquote</blockquote>' +
          '<ul><li>list item</li></ul>' +
          '<p><a href="https://www.trustroots.org/">link</a></p>';

        // Save a new message
        agent
          .post('/api/messages')
          .send(htmlMessage)
          .expect(200)
          .end(function (messageSaveErr) {
            // Handle message save error
            if (messageSaveErr) return done(messageSaveErr);

            // Get a list of messages
            agent
              .get('/api/messages/' + userToId)
              .end(function (messagesGetErr, messagesGetRes) {
                // Handle message get error
                if (messagesGetErr) return done(messagesGetErr);

                // Get messages list
                const thread = messagesGetRes.body;

                if (!thread[0] || !thread[0].content) {
                  return done(
                    new Error('Missing messages from the message thread.'),
                  );
                } else {
                  // Set assertions
                  thread[0].content.should.equal(htmlMessage.content);

                  // Call the assertion callback
                  return done();
                }
              });
          });
      });
  });

  it('should be able to send wrongly formatted html in an message and get back clean html', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Create html in message
        const htmlMessage = message;
        htmlMessage.content =
          '<strong>strong</strong><br><img src="http://www.trustroots.org/">' +
          '<foo>blockquote</foo><p>' +
          '<script></script>' +
          '<a href="https://www.trustroots.org/">link</a>' +
          'www.trustroots.org <iframe/>';

        // Save a new message
        agent
          .post('/api/messages')
          .send(htmlMessage)
          .expect(200)
          .end(function (messageSaveErr) {
            // Handle message save error
            if (messageSaveErr) return done(messageSaveErr);

            // Get a list of messages
            agent
              .get('/api/messages/' + userToId)
              .end(function (messagesGetErr, messagesGetRes) {
                // Handle message get error
                if (messagesGetErr) return done(messagesGetErr);

                // Get messages list
                const thread = messagesGetRes.body;

                if (!thread[0] || !thread[0].content) {
                  return done(
                    new Error('Missing messages from the message thread.'),
                  );
                } else {
                  // Set assertions
                  const output =
                    '<b>strong</b>' +
                    '<br />blockquote' +
                    '<p>' +
                    '<a href="https://www.trustroots.org/">link</a>' +
                    '<a href="http://www.trustroots.org">www.trustroots.org</a>' +
                    ' </p>';

                  thread[0].content.should.equal(output);

                  // Call the assertion callback
                  return done();
                }
              });
          });
      });
  });

  // Related to https://mathiasbynens.github.io/rel-noopener/
  it('should be able to send link tag with target="_blank" attribute and get back link without it.', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Create html in message
        const htmlMessage = message;
        htmlMessage.content =
          '<a href="https://www.trustroots.org/" target="_blank">This is nice!</a>';

        // Save a new message
        agent
          .post('/api/messages')
          .send(htmlMessage)
          .expect(200)
          .end(function (messageSaveErr) {
            // Handle message save error
            if (messageSaveErr) return done(messageSaveErr);

            // Get a list of messages
            agent
              .get('/api/messages/' + userToId)
              .end(function (messagesGetErr, messagesGetRes) {
                // Handle message get error
                if (messagesGetErr) return done(messagesGetErr);

                // Get messages list
                const thread = messagesGetRes.body;

                if (!thread[0] || !thread[0].content) {
                  return done(
                    new Error('Missing messages from the message thread.'),
                  );
                } else {
                  // Set assertions
                  thread[0].content.should.equal(
                    '<a href="https://www.trustroots.org/">This is nice!</a>',
                  );

                  // Call the assertion callback
                  return done();
                }
              });
          });
      });
  });

  it('should be able to send 25 messages and reading them should return messages in paginated order', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Now loop 25 messages in...
        // "Older" messages will have smaller numbers
        // @link https://github.com/caolan/async#whilsttest-fn-callback
        let count = 0;
        async.whilst(
          function () {
            return count < 25;
          },
          function (callback) {
            count++;
            const newMessage = message;
            newMessage.content = 'Message content ' + count;

            agent
              .post('/api/messages')
              .send(newMessage)
              .expect(200)
              .end(function (messageSaveErr) {
                // Handle message save error
                if (messageSaveErr) return done(messageSaveErr);

                // This message was saved okay, continue to the next one...
                callback(null, count);
              });
          },
          // All messages sent, continue.
          function (err) {
            if (err) return done(err);

            // Get a list of messages
            agent
              .get('/api/messages/' + userToId)
              .expect(200)
              .end(function (messagesGetErr, messagesGetRes) {
                // Handle message read error
                if (messagesGetErr) return done(messagesGetErr);

                // Check for pagination header
                const url =
                  (config.https ? 'https' : 'http') + '://' + config.domain;
                messagesGetRes.headers.link.should.equal(
                  '<' +
                    url +
                    '/api/messages/' +
                    userToId +
                    '?page=2&limit=20>; rel="next"',
                );

                // Get messages list
                const thread = messagesGetRes.body;

                if (!thread[0] || !thread[0].content) {
                  return done(
                    new Error('Missing messages from the message thread.'),
                  );
                } else {
                  // Pagination gives 20 messages at once
                  thread.length.should.equal(20);

                  // Set assertions for first and last message
                  thread[0].content.should.equal('Message content 25');
                  thread[19].content.should.equal('Message content 6');

                  // Get the 2nd page
                  agent
                    .get('/api/messages/' + userToId + '?page=2&limit=20')
                    .expect(200)
                    .end(function (messagesGetErr, messagesGetRes) {
                      // Handle message read error
                      if (messagesGetErr) return done(messagesGetErr);

                      // There are no more pages to paginate, link header shouldn't exist
                      should.not.exist(messagesGetRes.headers.link);

                      // Get messages list
                      const thread = messagesGetRes.body;

                      if (!thread[0] || !thread[0].content) {
                        return done(
                          new Error(
                            'Missing messages from the message thread.',
                          ),
                        );
                      } else {
                        // Pagination gives 20 messages at once but there are only 5 left for the 2nd page
                        thread.length.should.equal(5);

                        // Set assertions for first and last message
                        thread[0].content.should.equal('Message content 5');
                        thread[4].content.should.equal('Message content 1');

                        // Call the assertion callback
                        return done();
                      }
                    });
                }
              });
          },
        );
      });
  });

  it('should not be able to send a message to myself', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr, signinRes) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Get user id
        const userFromId = signinRes.body._id;

        const messageToMyself = message;
        messageToMyself.userTo = userFromId;

        // Save a new message
        agent
          .post('/api/messages')
          .send(messageToMyself)
          .expect(403)
          .end(function (messageSaveErr, messageSaveRes) {
            messageSaveRes.body.message.should.equal(
              'Recepient cannot be currently authenticated user.',
            );

            // Call the assertion callback
            return done(messageSaveErr);
          });
      });
  });

  it('should not be able to send a message without `userTo` field', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        delete message.userTo;

        agent
          .post('/api/messages')
          .send(message)
          .expect(400)
          .end(function (messageSaveErr, messageSaveRes) {
            messageSaveRes.body.message.should.equal('Missing `userTo` field.');

            // Call the assertion callback
            return done(messageSaveErr);
          });
      });
  });

  it('should get error if trying to send with invalid `userTo` id', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        message.userTo = '123';

        agent
          .post('/api/messages')
          .send(message)
          .expect(400)
          .end(function (messageSaveErr, messageSaveRes) {
            messageSaveRes.body.message.should.equal('Cannot interpret id.');

            // Call the assertion callback
            return done(messageSaveErr);
          });
      });
  });

  it('should not be able to send a message to non-existing user', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        message.userTo = '507f1f77bcf86cd799439011';

        agent
          .post('/api/messages')
          .send(message)
          .expect(404)
          .end(function (messageSaveErr, messageSaveRes) {
            messageSaveRes.body.message.should.equal(
              'Member you are writing to does not exist.',
            );

            // Call the assertion callback
            return done(messageSaveErr);
          });
      });
  });

  it('should not be able to send a message to non-public user', function (done) {
    User.findByIdAndUpdate(
      userToId,
      { $set: { public: false } },
      function (err) {
        if (err) return done(err);

        agent
          .post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            // Handle signin error
            if (signinErr) return done(signinErr);

            agent
              .post('/api/messages')
              .send(message)
              .expect(404)
              .end(function (messageSaveErr, messageSaveRes) {
                messageSaveRes.body.message.should.equal(
                  'Member you are writing to does not exist.',
                );

                // Call the assertion callback
                return done(messageSaveErr);
              });
          });
      },
    );
  });

  it('should not be able to send a message when I have too short description', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Update my description to be very short
        userFrom.description = 'short';
        userFrom.save(function (err, userFromSaveRes) {
          userFromSaveRes.description.should.equal('short');

          // Save a new message
          agent
            .post('/api/messages')
            .send(message)
            .expect(400)
            .end(function (messageSaveErr, messageSaveRes) {
              messageSaveRes.body.error.should.equal('empty-profile');
              messageSaveRes.body.limit.should.equal(
                config.profileMinimumLength,
              );
              messageSaveRes.body.message.should.equal(
                'Please write longer profile description before you send messages.',
              );

              // Call the assertion callback
              return done(messageSaveErr);
            });
        });
      });
  });

  it('should be able to send a message when I have too short description but another user wrote me first', function (done) {
    // Save message to this user from other user
    const newMessage = new Message({
      content: 'Enabling the latent trust between humans.',
      userFrom: userToId,
      userTo: userFromId,
      created: new Date(),
      read: true,
      notified: true,
    });

    newMessage.save(function (newMessageErr, newMessageRes) {
      // Handle save error
      if (newMessageErr) return done(newMessageErr);

      const newThread = new Thread({
        userFrom: userToId,
        userTo: userFromId,
        updated: new Date(),
        message: newMessageRes._id,
        read: true,
      });

      newThread.save(function (newThreadErr) {
        // Handle save error
        if (newThreadErr) return done(newThreadErr);

        // Sign in
        agent
          .post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            // Handle signin error
            if (signinErr) return done(signinErr);

            // Update my description to be very short
            userFrom.description = 'short';
            userFrom.save(function (err, userFromSaveRes) {
              userFromSaveRes.description.should.equal('short');

              // Save a new message
              agent
                .post('/api/messages')
                .send(message)
                .expect(200)
                .end(function (messageSaveErr, messageSaveRes) {
                  // Set assertions
                  messageSaveRes.body.userFrom._id.should.equal(
                    userFromId.toString(),
                  );
                  messageSaveRes.body.userTo._id.should.equal(
                    userToId.toString(),
                  );
                  messageSaveRes.body.content.should.equal('Message content');
                  messageSaveRes.body.read.should.equal(false);
                  should.not.exist(messageSaveRes.body.notified);

                  // Call the assertion callback
                  return done(messageSaveErr);
                });
            });
          });
      }); // newThread
    }); // newMessage
  });

  it('should not be able to check for unread message count if not logged in', function (done) {
    agent
      .get('/api/messages-count')
      .expect(403)
      .end(function (countReadErr, countReadRes) {
        countReadRes.body.message.should.equal('Forbidden.');

        // Call the assertion callback
        return done(countReadErr);
      });
  });

  it('should be able to check for unread message count if logged in', function (done) {
    // Sign in
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        agent
          .get('/api/messages-count')
          .expect(200)
          .end(function (countReadErr, countReadRes) {
            countReadRes.body.unread.should.equal(0);

            // Call the assertion callback
            return done(countReadErr);
          });
      });
  });

  it('should be able to check for unread message count if logged in', function (done) {
    // Save message to this user from other user
    const newMessage1 = new Message({
      content: 'Enabling the latent trust between humans.',
      userFrom: userToId,
      userTo: userFromId,
      created: new Date(),
      read: false,
      notified: true,
    });
    const newMessage2 = new Message({
      content: 'Another one!',
      userFrom: userToId,
      userTo: userFromId,
      created: new Date(),
      read: false,
      notified: true,
    });

    newMessage1.save(function (newMessage1Err) {
      // Handle save error
      if (newMessage1Err) return done(newMessage1Err);

      newMessage2.save(function (newMessage2Err, newMessage2Res) {
        // Handle save error
        if (newMessage2Err) return done(newMessage2Err);

        const newThread = new Thread({
          userFrom: userToId,
          userTo: userFromId,
          updated: new Date(),
          message: newMessage2Res._id,
          read: false,
        });

        newThread.save(function (newThreadErr) {
          // Handle save error
          if (newThreadErr) return done(newThreadErr);

          // Sign in
          agent
            .post('/api/auth/signin')
            .send(credentials)
            .expect(200)
            .end(function (signinErr) {
              // Handle signin error
              if (signinErr) return done(signinErr);

              agent
                .get('/api/messages-count')
                .expect(200)
                .end(function (countReadErr, countReadRes) {
                  // Although we saved two messages,
                  // but because we saved them to same thread,
                  // we should get `1` as a count.
                  countReadRes.body.unread.should.equal(1);

                  // Call the assertion callback
                  return done(countReadErr);
                });
            });
        });
      });
    });
  });

  it('should not be able to read sync endpoint if not logged in', function (done) {
    agent
      .get('/api/messages-sync')
      .expect(403)
      .end(function (messageSaveErr, messageSaveRes) {
        messageSaveRes.body.message.should.equal('Forbidden.');

        // Call the assertion callback
        return done(messageSaveErr);
      });
  });

  it('should be able to read sync endpoint and show messages sent from currently authenticated user', function (done) {
    // Save message to this user from other user
    const newMessage1 = new Message({
      content: 'One',
      userFrom: userFromId,
      userTo: userToId,
      created: moment('2016-06-06 19:00:00.174Z').toDate(),
      read: false,
      notified: true,
    });
    const newMessage2 = new Message({
      content: 'Two',
      userFrom: userFromId,
      userTo: userToId,
      created: moment('2016-06-06 19:00:00.174Z').add(30, 'minutes').toDate(),
      read: false,
      notified: true,
    });

    newMessage1.save(function (newMessage1Err) {
      // Handle save error
      if (newMessage1Err) return done(newMessage1Err);

      newMessage2.save(function (newMessage2Err, newMessage2Res) {
        // Handle save error
        if (newMessage2Err) return done(newMessage2Err);

        const newThread = new Thread({
          userFrom: userFromId,
          userTo: userToId,
          updated: moment('2016-06-06 19:00:00.174Z')
            .add(30, 'minutes')
            .toDate(),
          message: newMessage2Res._id,
          read: false,
        });

        newThread.save(function (newThreadErr) {
          // Handle save error
          if (newThreadErr) return done(newThreadErr);

          // Sign in
          agent
            .post('/api/auth/signin')
            .send(credentials)
            .expect(200)
            .end(function (signinErr) {
              // Handle signin error
              if (signinErr) return done(signinErr);

              agent
                .get('/api/messages-sync')
                .expect(200)
                .end(function (syncReadErr, syncReadRes) {
                  should.not.exist(
                    syncReadRes.body.messages[userFromId.toString()],
                  );

                  const messages =
                    syncReadRes.body.messages[userToId.toString()];

                  messages.length.should.equal(2);

                  should.exist(messages[0]._id);
                  should.exist(messages[0].created);
                  messages[0].read.should.equal(false);
                  messages[0].userTo.should.equal(userToId.toString());
                  messages[0].userFrom.should.equal(userFromId.toString());
                  messages[0].content.should.equal('Two');

                  should.exist(messages[1]._id);
                  should.exist(messages[1].created);
                  messages[1].read.should.equal(false);
                  messages[1].userTo.should.equal(userToId.toString());
                  messages[1].userFrom.should.equal(userFromId.toString());
                  messages[1].content.should.equal('One');

                  const users = syncReadRes.body.users;

                  users.length.should.equal(2);

                  users[0]._id.should.equal(userFromId.toString());
                  users[0].username.should.equal(userFrom.username);
                  should.exist(users[0].emailHash);
                  should.exist(users[0].displayName);
                  should.exist(users[0].avatarUploaded);
                  should.exist(users[0].avatarSource);

                  users[1]._id.should.equal(userToId.toString());
                  users[1].username.should.equal(userTo.username);
                  should.exist(users[1].emailHash);
                  should.exist(users[1].displayName);
                  should.exist(users[1].avatarUploaded);
                  should.exist(users[1].avatarSource);

                  // Call the assertion callback
                  return done(syncReadErr);
                });
            });
        });
      });
    });
  });

  it('should be able to read sync endpoint and show messages sent to currently authenticated user', function (done) {
    // Save message to this user from other user
    const newMessage1 = new Message({
      content: 'One',
      userFrom: userToId,
      userTo: userFromId,
      created: moment('2016-06-06 19:00:00.174Z').toDate(),
      read: false,
      notified: true,
    });
    const newMessage2 = new Message({
      content: 'Two',
      userFrom: userToId,
      userTo: userFromId,
      created: moment('2016-06-06 19:00:00.174Z').add(30, 'minutes').toDate(),
      read: false,
      notified: true,
    });

    newMessage1.save(function (newMessage1Err) {
      // Handle save error
      if (newMessage1Err) return done(newMessage1Err);

      newMessage2.save(function (newMessage2Err, newMessage2Res) {
        // Handle save error
        if (newMessage2Err) return done(newMessage2Err);

        const newThread = new Thread({
          userFrom: userToId,
          userTo: userFromId,
          updated: new Date(),
          message: newMessage2Res._id,
          read: false,
        });

        newThread.save(function (newThreadErr) {
          // Handle save error
          if (newThreadErr) return done(newThreadErr);

          // Sign in
          agent
            .post('/api/auth/signin')
            .send(credentials)
            .expect(200)
            .end(function (signinErr) {
              // Handle signin error
              if (signinErr) return done(signinErr);

              agent
                .get('/api/messages-sync')
                .expect(200)
                .end(function (syncReadErr, syncReadRes) {
                  should.not.exist(
                    syncReadRes.body.messages[userToId.toString()],
                  );

                  const messages =
                    syncReadRes.body.messages[userFromId.toString()];

                  messages.length.should.equal(2);

                  should.exist(messages[0]._id);
                  should.exist(messages[0].created);
                  messages[0].read.should.equal(false);
                  messages[0].userFrom.should.equal(userToId.toString());
                  messages[0].userTo.should.equal(userFromId.toString());
                  messages[0].content.should.equal('Two');

                  should.exist(messages[1]._id);
                  should.exist(messages[1].created);
                  messages[1].read.should.equal(false);
                  messages[1].userFrom.should.equal(userToId.toString());
                  messages[1].userTo.should.equal(userFromId.toString());
                  messages[1].content.should.equal('One');

                  const users = syncReadRes.body.users;

                  users.length.should.equal(2);

                  users[0]._id.should.equal(userFromId.toString());
                  users[0].username.should.equal(userFrom.username);
                  should.exist(users[0].emailHash);
                  should.exist(users[0].displayName);
                  should.exist(users[0].avatarUploaded);
                  should.exist(users[0].avatarSource);

                  users[1]._id.should.equal(userToId.toString());
                  users[1].username.should.equal(userTo.username);
                  should.exist(users[1].emailHash);
                  should.exist(users[1].displayName);
                  should.exist(users[1].avatarUploaded);
                  should.exist(users[1].avatarSource);

                  // Call the assertion callback
                  return done(syncReadErr);
                });
            });
        });
      });
    });
  });
});
