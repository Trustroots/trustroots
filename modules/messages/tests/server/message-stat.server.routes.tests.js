'use strict';

var path = require('path'),
    should = require('should'),
    async = require('async'),
    request = require('supertest'),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    MessageStat = mongoose.model('MessageStat'),
    express = require(path.resolve('./config/lib/express'));

describe('Display Message Statistics in User Route', function () {
  var agent;

  var NOW = Date.now(); // a current timestamp
  var DAY = 24 * 3600 * 1000; // a length of a day in milliseconds
  var messageStats = [];
  var users = [];

  var password = 'password123';

  before(function (done) {
    // Get application
    var app = express.init(mongoose.connection);
    agent = request.agent(app);

    done();
  });

  // create testing users
  before(function (done) {
    for (var i = 0; i < 23; ++i) {
      users.push(new User({
        firstName: 'firstName',
        lastName: 'lastName',
        displayName: 'displayName',
        email: 'user' + i + '@example.com',
        username: 'username' + i,
        password: password,
        provider: 'local',
        public: true
      }));
    }

    // Save the users to database
    async.each(users,
      function (user, callback) {
        user.save(callback);
      }, done);
  });

  // create testing messageStats
  before(function (done) {
    // every thread is initiated by different user (user 0 is the receiver of all)

    var userno = 3; // the index of user who sent the first message
    // is incremented for every message, closure

    /**
     * DRYing generating the messageStats
     * @param {number} userTo - index of receiver of the first message
     * @param {number} count - amount of messageStats to create
     * @param {number} count - amount of messageStats which are replied
     * @param {number} replyTime - timeToFirstReply for messageStats [millisecond]
     * @param {timeNow} number - minimum timestamp of the firstMessageCreated
     */
    function generateMessageStats(userTo, count, repliedCount, replyTime, timeNow) {
      for (var i = 0; i < count; ++i) {
        var firstCreated = timeNow - replyTime - (i + 1) * DAY;
        messageStats.push(new MessageStat({
          firstMessageUserFrom: users[userno]._id,
          firstMessageUserTo: users[userTo]._id,
          firstMessageCreated: new Date(firstCreated),
          firstMessageLength: 100,
          firstReplyCreated: i < repliedCount ? new Date(firstCreated + replyTime) : null,
          firstReplyLength: i < repliedCount ? 50 : null,
          timeToFirstReply: i < repliedCount ? replyTime : null
        }));

        // increment the userFrom
        ++userno;
      }
    }

    // 12 messages to user0 (5 of them replied within 175 minutes)
    // (approx. 3 hours)
    generateMessageStats(0, 12, 5, 175 * 60 * 1000, NOW);
    // + 8 messages to user1 (0 replied)
    generateMessageStats(1, 8, 0, 0, NOW);
    // 0 messages to user2
    generateMessageStats(2, 0, 0, 0, NOW);


    // Save the messageStats to database
    async.each(messageStats,
      function (messageStat, callback) {
        messageStat.save(callback);
      }, done);
  });

  // clean the database after the tests
  after(function (done) {
    // remove all User, MessageStat
    async.parallel([
      function (cb) {
        User.remove().exec(cb);
      },
      function (cb) {
        MessageStat.remove().exec(cb);
      }
    ], done);
  });

  // Sign in
  beforeEach(function (done) {
    var credentials = { username: users[4].username, password: password };

    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (err) {
        if (err) return done(err);
        return done();
      });
  });

  // Sign out
  afterEach(function (done) {
    agent.get('/api/auth/signout')
      .expect(302)
      .end(function (err) {
        if (err) return done(err);
        return done();
      });
  });

  it('should show replyRate and replyTime in user\'s profile',
    function (done) {
      // request a random user
      agent.get('/api/users/' + users[5].username)
        .expect(200)
        .end(function (err, resp) {
          if (err) return done(err);
          try {
            var response = resp.body;

            should(response).have.property('replyRate');
            should(response).have.property('replyTime');

            return done();
          } catch (e) {
            if (e) return done(e);
          }
        });
    });

  it('[no messages] replyRate and replyTime should be \'\'',
    function (done) {
      // user username2 has no MessageStats
      agent.get('/api/users/' + users[2].username)
        .expect(200)
        .end(function (err, resp) {
          if (err) return done(err);
          try {
            var response = resp.body;

            should(response).have.property('replyRate', '');
            should(response).have.property('replyTime', '');

            return done();
          } catch (e) {
            if (e) return done(e);
          }
        });
    });

  it('[no replied messages] replyRate should be \'0%\' and replyTime \'\'',
    function (done) {
      // user username1 has only unreplied MessageStats
      agent.get('/api/users/' + users[1].username)
        .expect(200)
        .end(function (err, resp) {
          if (err) return done(err);
          try {
            var response = resp.body;

            should(response).have.property('replyRate', '0%');
            should(response).have.property('replyTime', '');

            return done();
          } catch (e) {
            if (e) return done(e);
          }
        });
    });

  it('[some replied messages] replyRate and replyTime should be strings with specific values',
    function (done) {
      // user username0 has both replied and unreplied MessageStats
      agent.get('/api/users/' + users[0].username)
        .expect(200)
        .end(function (err, resp) {
          if (err) return done(err);
          try {
            var response = resp.body;

            should(response).have.property('replyRate',
              Math.round(5 / 12 * 100) + '%');
            should(response).have.property('replyTime', '3 hours');

            return done();
          } catch (e) {
            if (e) return done(e);
          }
        });
    });
});
