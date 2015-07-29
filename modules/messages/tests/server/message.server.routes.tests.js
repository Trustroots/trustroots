'use strict';

var should = require('should'),
    request = require('supertest'),
    path = require('path'),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Message = mongoose.model('Message'),
    Thread = mongoose.model('Thread'),
    express = require(path.resolve('./config/lib/express'));

/**
 * Globals
 */
var app, agent, credentials, userFrom, userTo, userFromId, userToId, message, thread;

/**
 * Message routes tests
 */
describe('Message CRUD tests', function() {
  before(function(done) {
    // Get application
    app = express.init(mongoose);
    agent = request.agent(app);

    done();
  });

  beforeEach(function(done) {
    // Create userFrom credentials
    credentials = {
      username: 'username1',
      password: 'password123'
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
      public: true
    });

    userTo = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test2@test.com',
      username: 'username2',
      password: 'password123',
      provider: 'local',
      public: true
    });

    // Save users to the test db and create new message
    userFrom.save(function() {
      userTo.save(function() {
        // Check id for userTo
        User.findOne({'username': userTo.username}, function(err, userTo) {

          // Get id
          userToId = userTo._id;

          // Create message
          message = {
            content: 'Message content',
            userTo: userToId
          };
          done();
        });

      });
    });
  });

  it('should not be able to read inbox if not logged in', function(done) {
    agent.get('/api/messages')
      .expect(403)
      .end(function(messageSaveErr, messageSaveRes) {
        // Call the assertion callback
        done(messageSaveErr);
      });
  });

  it('should not be able to send message if not logged in', function(done) {
    agent.post('/api/messages')
      .send(message)
      .expect(403)
      .end(function(messageSaveErr, messageSaveRes) {
        // Call the assertion callback
        done(messageSaveErr);
      });
  });

  it('should be able to send an message if logged in', function(done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function(signinErr, signinRes) {
        // Handle signin error
        if (signinErr) done(signinErr);

        // Get user id
        var userFromId = signinRes.body._id;

        // Save a new message
        agent.post('/api/messages')
          .send(message)
          .expect(200)
          .end(function(messageSaveErr, messageSaveRes) {
            // Handle message save error
            if (messageSaveErr) done(messageSaveErr);

            // Get a list of messages
            agent.get('/api/messages/' + userToId)
              .end(function(messagesGetErr, messagesGetRes) {
                // Handle message save error
                if (messagesGetErr) done(messagesGetErr);

                // Get messages list
                var thread = messagesGetRes.body;

                if(!thread[0] || !thread[0].content) {
                  done(new Error('Missing messages from the message thread.'));
                }
                else {

                  // Set assertions
                  (thread[0].userFrom._id.toString()).should.equal(userFromId.toString());
                  (thread[0].userTo._id.toString()).should.equal(userToId.toString());
                  (thread[0].content).should.match('Message content');

                  // Call the assertion callback
                  done();
                }

              });
          });
      });
  });

  afterEach(function(done) {
    // Uggggly pyramid revenge!
    User.remove().exec(function() {
      Message.remove().exec(function() {
        Thread.remove().exec(done);
      });
    });
  });
});
