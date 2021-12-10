const request = require('supertest');
const path = require('path');
const mongoose = require('mongoose');
const Message = mongoose.model('Message');
const User = mongoose.model('User');
const express = require(path.resolve('./config/lib/express'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));
require('should');

/**
 * Globals
 */
let app;
let agent;
let credentialsAdmin;
let credentialsRegular;
let userAdmin;
let userRegular1;
let userRegular2;
let userRegular1Id;
let userRegular2Id;

describe('Admin Message CRUD tests', () => {
  before(done => {
    // Get application
    app = express.init(mongoose.connection);
    agent = request.agent(app);

    done();
  });

  beforeEach(async () => {
    try {
      // Create admin credentials
      credentialsAdmin = {
        username: 'user-admin',
        password: 'Password123!',
      };

      // Create regular user credentials
      credentialsRegular = {
        username: 'user-regular1',
        password: 'Password123!',
      };

      // Create a new admin user
      userAdmin = new User({
        displayName: 'Admin Name',
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'Name',
        member: [],
        provider: 'local',
        public: true,
        roles: ['user', 'admin'],
        ...credentialsAdmin,
      });

      await userAdmin.save();

      // Create a new regular user
      userRegular1 = new User({
        displayName: 'Full Name1',
        email: 'regular1@example.com',
        firstName: 'Full',
        lastName: 'Name2',
        member: [],
        provider: 'local',
        public: true,
        roles: ['user'],
        ...credentialsRegular,
      });

      // Create a new regular user
      userRegular2 = new User({
        displayName: 'Full Name2',
        email: 'regular2@example.com',
        firstName: 'Full',
        lastName: 'Name2',
        member: [],
        provider: 'local',
        public: true,
        roles: ['user'],
        username: 'user-regular2',
        password: 'Password123!',
      });

      const { _id: _userRegular1Id } = await userRegular1.save();
      const { _id: _userRegular2Id } = await userRegular2.save();
      userRegular1Id = _userRegular1Id;
      userRegular2Id = _userRegular2Id;

      const message1 = new Message({
        content: 'test',
        notificationCount: 0,
        userFrom: userRegular1Id,
        userTo: userRegular2Id,
      });

      const message2 = new Message({
        content: 'test',
        notificationCount: 0,
        userFrom: userRegular2Id,
        userTo: userRegular1Id,
      });

      await message1.save();
      await message2.save();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  });

  afterEach(utils.clearDatabase);

  describe('Read messages between two users', () => {
    it('non-authenticated users should not be allowed to read messages', done => {
      agent
        .post('/api/admin/messages')
        .send({ user1: userRegular1Id, user2: userRegular2Id })
        .expect(403)
        .end((err, res) => {
          res.body.message.should.equal('Forbidden.');
          return done(err);
        });
    });

    it('non-admin users should not be allowed to read messages', done => {
      agent
        .post('/api/auth/signin')
        .send(credentialsRegular)
        .expect(200)
        .end(signinErr => {
          if (signinErr) {
            return done(signinErr);
          }

          agent
            .post('/api/admin/messages')
            .send({ user1: userRegular1Id, user2: userRegular2Id })
            .expect(403)
            .end((err, res) => {
              res.body.message.should.equal('Forbidden.');
              return done(err);
            });
        });
    });

    it('admin users should be allowed to read messages', done => {
      agent
        .post('/api/auth/signin')
        .send(credentialsAdmin)
        .expect(200)
        .end(signinErr => {
          if (signinErr) {
            return done(signinErr);
          }

          agent
            .post('/api/admin/messages')
            .send({ user1: userRegular1Id, user2: userRegular2Id })
            .expect(200)
            .end((err, res) => {
              res.body.length.should.equal(2);
              res.body[0].userFrom.username.should.equal('user-regular1');
              res.body[0].userTo.username.should.equal('user-regular2');
              return done(err);
            });
        });
    });
  });
});
