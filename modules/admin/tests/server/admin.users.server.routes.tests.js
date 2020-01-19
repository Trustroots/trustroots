const request = require('supertest');
const path = require('path');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const express = require(path.resolve('./config/lib/express'));
const should = require('should');
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

/**
 * Globals
 */
let credentialsAdmin;
let credentialsRegular;
let userAdmin;
let userRegular;
let userRegularId;

describe('Admin User CRUD tests', () => {
  // Get application
  const app = express.init(mongoose.connection);
  const agent = request.agent(app);

  beforeEach(async () => {
    try {
      // Create admin credentials
      credentialsAdmin = {
        username: 'user-admin',
        password: 'Password123!',
      };

      // Create regular user credentials
      credentialsRegular = {
        username: 'user-regular',
        password: 'Password123!',
      };

      // Create a new admin user
      userAdmin = new User({
        displayName: 'Admin Name',
        email: 'admin@example.com',
        emailToken: 'test-token',
        firstName: 'Admin',
        lastName: 'Name',
        member: [],
        provider: 'local',
        public: true,
        removeProfileToken: 'test-token',
        resetPasswordToken: 'test-token',
        roles: ['user', 'admin'],
        ...credentialsAdmin,
      });

      // Create a new regular user
      userRegular = new User({
        displayName: 'Full Name',
        email: 'regular@example.com',
        emailToken: 'test-token',
        firstName: 'Full',
        lastName: 'Name',
        member: [],
        provider: 'local',
        public: true,
        removeProfileToken: 'test-token',
        resetPasswordToken: 'test-token',
        roles: ['user'],
        ...credentialsRegular,
      });

      await userAdmin.save();
      const { _id: _userRegularId } = await userRegular.save();
      userRegularId = _userRegularId;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  });

  afterEach(utils.clearDatabase);

  describe('As non-authenticated user...', () => {
    it('Non-authenticated users should not be allowed to search users', (done) => {
      agent.post('/api/admin/users')
        .send({ search: 'Name' })
        .expect(403)
        .end(done);
    });

    it('Non-authenticated users should not be allowed to list users by role', (done) => {
      agent.post('/api/admin/users/by-role')
        .send({ role: 'admin' })
        .expect(403)
        .end(done);
    });

    it('Mon-authenticated users should not be allowed to get user by ID', (done) => {
      agent.post('/api/admin/user')
        .send({ id: userRegularId })
        .expect(403)
        .end(done);
    });

    it('Non-authenticated users should not be allowed to change user roles', (done) => {
      agent.post('/api/admin/user/change-role')
        .send({ id: userRegularId, role: 'suspended' })
        .expect(403)
        .end(done);
    });

    it('Non-authenticated users should not be allowed to change user roles', (done) => {
      agent.post('/api/admin/user/change-role')
        .send({ id: userRegularId, role: 'suspended' })
        .expect(403)
        .end(done);
    });
  });

  describe('As authenticated user...', () => {

    afterEach(async () => {
      await utils.signOut(agent);
    });

    describe('Search users', () => {

      it('non-admin users should not be allowed to search', async (done) => {
        await utils.signIn(credentialsRegular, agent);

        agent.post('/api/admin/users')
          .send({ search: 'Name' })
          .expect(403)
          .end(done);
      });

      it('admin users should be allowed to search and get correct results', async (done) => {
        await utils.signIn(credentialsAdmin, agent);

        agent.post('/api/admin/users')
          .send({ search: 'Name' })
          .expect(200)
          .end((err, res) => {
            res.body.length.should.equal(2);

            res.body[0].username.should.equal('user-admin');
            res.body[1].username.should.equal('user-regular');

            res.body.forEach((user) => {
              // These should have been removed
              should.not.exist(user.password);
              should.not.exist(user.salt);
              // These should have been obfuscated
              user.removeProfileToken.should.equal('(Hidden from admins.)');
              user.resetPasswordToken.should.equal('(Hidden from admins.)');
            });

            done(err);
          });
      });

      it('should find by username', async (done) => {
        await utils.signIn(credentialsAdmin, agent);

        agent.post('/api/admin/users')
          .send({ search: 'user-regular' })
          .expect(200)
          .end((err, res) => {
            res.body.length.should.equal(1);
            res.body[0].username.should.equal('user-regular');
            done(err);
          });
      });

      it('should find by email', async (done) => {
        await utils.signIn(credentialsAdmin, agent);

        agent.post('/api/admin/users')
          .send({ search: 'regular@example.com' })
          .expect(200)
          .end((err, res) => {
            res.body.length.should.equal(1);
            res.body[0].email.should.equal('regular@example.com');
            done(err);
          });
      });
    });

    describe('List users by role', () => {

      it('non-admin users should not be allowed to list users by role', async (done) => {
        await utils.signIn(credentialsRegular, agent);

        agent.post('/api/admin/users/by-role')
          .send({ role: 'admin' })
          .expect(403)
          .end(done);
      });

      it('admin users should be allowed to list users by role and get correct results', async (done) => {
        await utils.signIn(credentialsAdmin, agent);

        agent.post('/api/admin/users/by-role')
          .send({ role: 'admin' })
          .expect(200)
          .end((err, res) => {
            res.body.length.should.equal(1);

            const user = res.body[0];

            user.username.should.equal('user-admin');
            // These should have been removed
            should.not.exist(user.password);
            should.not.exist(user.salt);
            // These should have been obfuscated
            user.removeProfileToken.should.equal('(Hidden from admins.)');
            user.resetPasswordToken.should.equal('(Hidden from admins.)');

            done(err);
          });
      });

      it('listing users by invalid role should not be possible', async (done) => {
        await utils.signIn(credentialsAdmin, agent);

        agent.post('/api/admin/users/by-role')
          .send({ role: 'fake' })
          .expect(400)
          .end(done);
      });

    });

    describe('Get user by ID', () => {

      it('non-admin users should not be allowed to query', async (done) => {
        await utils.signIn(credentialsRegular, agent);

        agent.post('/api/admin/user')
          .send({ id: userRegularId })
          .expect(403)
          .end((err, res) => {
            res.body.message.should.equal('Forbidden.');
            return done(err);
          });
      });

      it('admin users should be allowed to query and get correct result', async (done) => {
        await utils.signIn(credentialsAdmin, agent);

        agent.post('/api/admin/user')
          .send({ id: userRegularId })
          .expect(200)
          .end((err, res) => {
            const profile = res.body.profile;

            profile.username.should.equal('user-regular');
            profile.emailToken.should.equal('test-token');
            // These should have been removed
            should.not.exist(profile.password);
            should.not.exist(profile.salt);
            // These should have been obfuscated
            profile.removeProfileToken.should.equal('(Hidden from admins.)');
            profile.resetPasswordToken.should.equal('(Hidden from admins.)');
            done(err);
          });
      });

      it('missing id should return no users', async (done) => {
        await utils.signIn(credentialsAdmin, agent);

        agent.post('/api/admin/user')
          .send({ id: '' })
          .expect(400)
          .end((err, res) => {
            res.body.message.should.equal('Cannot interpret id.');
            done(err);
          });
      });

      it('invalid id should return no users', async (done) => {
        await utils.signIn(credentialsAdmin, agent);

        agent.post('/api/admin/user')
          .send({ id: '123' })
          .expect(400)
          .end((err, res) => {
            res.body.message.should.equal('Cannot interpret id.');
            done(err);
          });
      });
    });

    describe('Changing user roles', () => {

      it('non-admin users should not be allowed to change user roles', async (done) => {
        await utils.signIn(credentialsRegular, agent);

        agent.post('/api/admin/user/change-role')
          .send({ id: userRegularId, role: 'suspended' })
          .expect(403)
          .end((err, res) => {
            res.body.message.should.equal('Forbidden.');
            return done(err);
          });
      });

      ['moderator', 'shadowban', 'suspended'].map((role) => {
        it(`admin users should be allowed change user role to ${role}`, async (done) => {
          await utils.signIn(credentialsAdmin, agent);

          // Allowed roles
          agent.post('/api/admin/user/change-role')
            .send({ id: userRegularId, role })
            .expect(200)
            .end(done);
        });
      });

      it('missing id should not change user role', async (done) => {
        await utils.signIn(credentialsAdmin, agent);

        agent.post('/api/admin/user/change-role')
          .send({ id: '', role: 'suspended' })
          .expect(400)
          .end((err, res) => {
            res.body.message.should.equal('Cannot interpret id.');
            done(err);
          });
      });

      it('invalid role should not be change user roles', async (done) => {
        await utils.signIn(credentialsAdmin, agent);

        agent.post('/api/admin/user/change-role')
          .send({ id: userRegularId, role: 'fake' })
          .expect(400)
          .end((err, res) => {
            res.body.message.should.equal('Invalid role.');
            done(err);
          });
      });

      it('cannot change user role to admin', async (done) => {
        await utils.signIn(credentialsAdmin, agent);

        agent.post('/api/admin/user/change-role')
          .send({ id: userRegularId, role: 'admin' })
          .expect(400)
          .end((err, res) => {
            res.body.message.should.equal('Invalid role.');
            done(err);
          });
      });

      it('invalid id should not change user roles', async (done) => {
        await utils.signIn(credentialsAdmin, agent);

        agent.post('/api/admin/user/change-role')
          .send({ id: '123', role: 'suspended' })
          .expect(400)
          .end((err, res) => {
            res.body.message.should.equal('Cannot interpret id.');
            done(err);
          });
      });
    });
  });

});
