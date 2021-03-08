const mongoose = require('mongoose');
const path = require('path');
const request = require('supertest');
const should = require('should');

const express = require(path.resolve('./config/lib/express'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

const User = mongoose.model('User');

/**
 * Globals
 */
let credentialsAdmin;
let credentialsRegular;
let userAdmin;
let userAdminId;
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
        created: new Date(),
        ...credentialsRegular,
      });

      const { _id: _userAdminId } = await userAdmin.save();
      userAdminId = _userAdminId.toString();
      const { _id: _userRegularId } = await userRegular.save();
      userRegularId = _userRegularId.toString();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  });

  afterEach(utils.clearDatabase);

  describe('As non-authenticated user...', () => {
    it('Non-authenticated users should not be allowed to search users', async () => {
      await agent.post('/api/admin/users').send({ search: 'Name' }).expect(403);
    });

    it('Non-authenticated users should not be allowed to list users by role', async () => {
      await agent
        .post('/api/admin/users/by-role')
        .send({ role: 'admin' })
        .expect(403);
    });

    it('Mon-authenticated users should not be allowed to get user by ID', async () => {
      await agent
        .post('/api/admin/user')
        .send({ id: userRegularId })
        .expect(403);
    });

    it('Non-authenticated users should not be allowed to change user roles', async () => {
      await agent
        .post('/api/admin/user/change-role')
        .send({ id: userRegularId, role: 'suspended' })
        .expect(403);
    });

    it('Non-authenticated users should not be allowed to change user roles', async () => {
      await agent
        .post('/api/admin/user/change-role')
        .send({ id: userRegularId, role: 'suspended' })
        .expect(403);
    });
  });

  describe('As authenticated user...', () => {
    afterEach(async () => {
      await utils.signOut(agent);
    });

    describe('Search users', () => {
      it('non-admin users should not be allowed to search', async () => {
        await utils.signIn(credentialsRegular, agent);

        await agent
          .post('/api/admin/users')
          .send({ search: 'Name' })
          .expect(403);
      });

      it('admin users should be allowed to search and get correct results', async () => {
        await utils.signIn(credentialsAdmin, agent);

        const { body } = await agent
          .post('/api/admin/users')
          .send({ search: 'Name' })
          .expect(200);

        should(body.length).equal(2);

        should.exist(body[0].created);
        should.exist(body[1].created);
        should(body[0].username).equal('user-admin');
        should(body[1].username).equal('user-regular');

        body.forEach(user => {
          // These should have been removed
          should.not.exist(user.password);
          should.not.exist(user.salt);
          // These should have been obfuscated
          should(user.removeProfileToken).equal('(Hidden from admins.)');
          should(user.resetPasswordToken).equal('(Hidden from admins.)');
        });
      });

      it('should find by username', async () => {
        await utils.signIn(credentialsAdmin, agent);

        const { body } = await agent
          .post('/api/admin/users')
          .send({ search: 'user-regular' })
          .expect(200);

        should(body.length).equal(1);
        should(body[0].username).equal('user-regular');
      });

      it('should find by email', async () => {
        await utils.signIn(credentialsAdmin, agent);

        const { body } = await agent
          .post('/api/admin/users')
          .send({ search: 'regular@example.com' })
          .expect(200);

        should(body.length).equal(1);
        should(body[0].email).equal('regular@example.com');
      });
    });

    describe('List users by role', () => {
      it('non-admin users should not be allowed to list users by role', async () => {
        await utils.signIn(credentialsRegular, agent);

        await agent
          .post('/api/admin/users/by-role')
          .send({ role: 'admin' })
          .expect(403);
      });

      it('admin users should be allowed to list users by role and get correct results', async () => {
        await utils.signIn(credentialsAdmin, agent);

        const { body } = await agent
          .post('/api/admin/users/by-role')
          .send({ role: 'admin' })
          .expect(200);

        should(body.length).equal(1);

        const user = body[0];

        should(user.username).equal('user-admin');

        // These should have been removed
        should.not.exist(user.password);
        should.not.exist(user.salt);

        // These should have been obfuscated
        should(user.removeProfileToken).equal('(Hidden from admins.)');
        should(user.resetPasswordToken).equal('(Hidden from admins.)');
      });

      it('listing users by invalid role should not be possible', async () => {
        await utils.signIn(credentialsAdmin, agent);

        await agent
          .post('/api/admin/users/by-role')
          .send({ role: 'fake' })
          .expect(400);
      });
    });

    describe('Get user by ID', () => {
      it('non-admin users should not be allowed to query', async () => {
        await utils.signIn(credentialsRegular, agent);

        await agent
          .post('/api/admin/user')
          .send({ id: userRegularId })
          .expect(403);
      });

      it('admin users should be allowed to query and get correct result', async () => {
        await utils.signIn(credentialsAdmin, agent);

        const { body } = await agent
          .post('/api/admin/user')
          .send({ id: userRegularId })
          .expect(200);

        should(body.profile.username).equal('user-regular');
        should(body.profile.emailToken).equal('test-token');

        // These should have been removed
        should.not.exist(body.profile.password);
        should.not.exist(body.profile.salt);

        // These should have been obfuscated
        should(body.profile.removeProfileToken).equal('(Hidden from admins.)');
        should(body.profile.resetPasswordToken).equal('(Hidden from admins.)');
      });

      it('missing id should return no users', async () => {
        await utils.signIn(credentialsAdmin, agent);

        const { body } = await agent
          .post('/api/admin/user')
          .send({ id: '' })
          .expect(400);

        should(body.message).equal('Cannot interpret id.');
      });

      it('invalid id should return no users', async () => {
        await utils.signIn(credentialsAdmin, agent);

        const { body } = await agent
          .post('/api/admin/user')
          .send({ id: '123' })
          .expect(400);

        should(body.message).equal('Cannot interpret id.');
      });
    });

    describe('Changing user roles', () => {
      it('non-admin users should not be allowed to change user roles', async () => {
        await utils.signIn(credentialsRegular, agent);

        await agent
          .post('/api/admin/user/change-role')
          .send({ id: userRegularId, role: 'suspended' })
          .expect(403);
      });

      // Allowed roles
      ['moderator', 'shadowban', 'suspended'].map(role => {
        it(`admin users should be allowed change user role to ${role}`, async () => {
          await utils.signIn(credentialsAdmin, agent);

          await agent
            .post('/api/admin/user/change-role')
            .send({ id: userRegularId, role })
            .expect(200);
        });
      });

      it('missing id should not change user role', async () => {
        await utils.signIn(credentialsAdmin, agent);

        const { body } = await agent
          .post('/api/admin/user/change-role')
          .send({ id: '', role: 'suspended' })
          .expect(400);

        should(body.message).equal('Cannot interpret id.');
      });

      it('invalid role should not be change user roles', async () => {
        await utils.signIn(credentialsAdmin, agent);

        const { body } = await agent
          .post('/api/admin/user/change-role')
          .send({ id: userRegularId, role: 'fake' })
          .expect(400);

        should(body.message).equal('Invalid role.');
      });

      it('cannot change user role to admin', async () => {
        await utils.signIn(credentialsAdmin, agent);

        const { body } = await agent
          .post('/api/admin/user/change-role')
          .send({ id: userRegularId, role: 'admin' })
          .expect(400);

        should(body.message).equal('Invalid role.');
      });

      it('invalid id should not change user roles', async () => {
        await utils.signIn(credentialsAdmin, agent);

        const { body } = await agent
          .post('/api/admin/user/change-role')
          .send({ id: '123', role: 'suspended' })
          .expect(400);

        should(body.message).equal('Cannot interpret id.');
      });

      it(`changing role should show up as an admin note`, async () => {
        await utils.signIn(credentialsAdmin, agent);

        await agent
          .post('/api/admin/user/change-role')
          .send({ id: userRegularId, role: 'suspended' })
          .expect(200);

        const { body } = await agent
          .get(`/api/admin/notes?userId=${userRegularId}`)
          .expect(200);

        body[0].note.should.equal(
          '<p><b>Performed action:</b></p><p><i>User suspended.</i></p>',
        );
        body[0].admin._id.should.equal(userAdminId);
      });
    });
  });
});
