const path = require('path');
const should = require('should');
const async = require('async');
const request = require('supertest');
const mongoose = require('mongoose');
const express = require(path.resolve('./config/lib/express'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

const User = mongoose.model('User');
const MessageStat = mongoose.model('MessageStat');

describe('Display Message Statistics in User Route', function () {
  let agent;

  const NOW = Date.now(); // a current timestamp
  const DAY = 24 * 3600 * 1000; // a length of a day in milliseconds
  const messageStats = [];
  const users = [];

  const password = 'password123';

  before(function (done) {
    // Get application
    const app = express.init(mongoose.connection);
    agent = request.agent(app);

    done();
  });

  // create testing users
  before(function (done) {
    for (let i = 0; i < 23; ++i) {
      users.push(
        new User({
          firstName: 'firstName',
          lastName: 'lastName',
          displayName: 'displayName',
          email: 'user' + i + '@example.com',
          username: 'username' + i,
          password,
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

    let userno = 3; // the index of user who sent the first message
    // is incremented for every message, closure

    /**
     * DRYing generating the messageStats
     * @param {number} userTo - index of receiver of the first message
     * @param {number} count - amount of messageStats to create
     * @param {number} count - amount of messageStats which are replied
     * @param {number} replyTime - timeToFirstReply for messageStats [millisecond]
     * @param {timeNow} number - minimum timestamp of the firstMessageCreated
     */
    function generateMessageStats(
      userTo,
      count,
      repliedCount,
      replyTime,
      timeNow,
    ) {
      for (let i = 0; i < count; ++i) {
        const firstCreated = timeNow - replyTime - (i + 1) * DAY;
        messageStats.push(
          new MessageStat({
            firstMessageUserFrom: users[userno]._id,
            firstMessageUserTo: users[userTo]._id,
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

    // 12 messages to user0 (5 of them replied within 175 minutes)
    // (approx. 3 hours)
    generateMessageStats(0, 12, 5, 175 * 60 * 1000, NOW);
    // + 8 messages to user1 (0 replied)
    generateMessageStats(1, 8, 0, 0, NOW);
    // 0 messages to user2
    generateMessageStats(2, 0, 0, 0, NOW);

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

  // Sign in
  beforeEach(async () => {
    const credentials = { username: users[4].username, password };
    await utils.signIn(credentials, agent);
  });

  // Sign out
  afterEach(async () => {
    await utils.signOut(agent);
  });

  it("should show replyRate and replyTime in user's profile", function (done) {
    // request a random user
    agent
      .get('/api/users/' + users[5].username)
      .expect(200)
      .end(function (err, resp) {
        if (err) return done(err);
        try {
          const response = resp.body;

          should(response).have.property('replyRate');
          should(response).have.property('replyTime');

          return done();
        } catch (e) {
          if (e) return done(e);
        }
      });
  });

  it("[no messages] replyRate and replyTime should be ''", function (done) {
    // user username2 has no MessageStats
    agent
      .get('/api/users/' + users[2].username)
      .expect(200)
      .end(function (err, resp) {
        if (err) return done(err);
        try {
          const response = resp.body;

          should(response).have.property('replyRate', '');
          should(response).have.property('replyTime', '');

          return done();
        } catch (e) {
          if (e) return done(e);
        }
      });
  });

  it("[no replied messages] replyRate should be '0%' and replyTime ''", function (done) {
    // user username1 has only unreplied MessageStats
    agent
      .get('/api/users/' + users[1].username)
      .expect(200)
      .end(function (err, resp) {
        if (err) return done(err);
        try {
          const response = resp.body;

          should(response).have.property('replyRate', '0%');
          should(response).have.property('replyTime', '');

          return done();
        } catch (e) {
          if (e) return done(e);
        }
      });
  });

  it('[some replied messages] replyRate and replyTime should be strings with specific values', function (done) {
    // user username0 has both replied and unreplied MessageStats
    agent
      .get('/api/users/' + users[0].username)
      .expect(200)
      .end(function (err, resp) {
        if (err) return done(err);
        try {
          const response = resp.body;

          should(response).have.property(
            'replyRate',
            Math.round((5 / 12) * 100) + '%',
          );
          should(response).have.property('replyTime', '3 hours');

          return done();
        } catch (e) {
          if (e) return done(e);
        }
      });
  });
});
