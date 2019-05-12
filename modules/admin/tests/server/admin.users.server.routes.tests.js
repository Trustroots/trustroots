const request = require('supertest');
const path = require('path');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const express = require(path.resolve('./config/lib/express'));
const should = require('should');

/**
 * Globals
 */
let app;
let agent;
let credentialsAdmin;
let credentialsRegular;
let userAdmin;
let userRegular;
let userRegularId;

/**
 * Offer routes tests
 */
describe('Admin User CRUD tests', () => {

  before((done) => {
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
        password: 'Password123!'
      };

      // Create regular user credentials
      credentialsRegular = {
        username: 'user-regular',
        password: 'Password123!'
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
        ...credentialsAdmin
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
        ...credentialsRegular
      });

      await userAdmin.save();
      const { _id: _userRegularId } = await userRegular.save();
      userRegularId = _userRegularId;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  });

  describe('Search users', () => {
    it('non-authenticated users should not be allowed to search', (done) => {
      agent.post('/api/admin/users')
        .send({ 'search': 'Name' })
        .expect(403)
        .end((err, res) => {
          res.body.message.should.equal('Forbidden.');
          return done(err);
        });
    });

    it('non-admin users should not be allowed to search', (done) => {
      agent.post('/api/auth/signin')
        .send(credentialsRegular)
        .expect(200)
        .end((signinErr) => {
          if (signinErr) {
            return done(signinErr);
          }

          agent.post('/api/admin/users')
            .send({ 'search': 'Name' })
            .expect(403)
            .end((err, res) => {
              res.body.message.should.equal('Forbidden.');
              return done(err);
            });
        });
    });

    it('admin users should be allowed to search and get correct results', (done) => {
      agent.post('/api/auth/signin')
        .send(credentialsAdmin)
        .expect(200)
        .end((signinErr) => {
          if (signinErr) {
            return done(signinErr);
          }

          agent.post('/api/admin/users')
            .send({ 'search': 'Name' })
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

              return done(err);
            });
        });
    });

    it('should find by username', (done) => {
      agent.post('/api/auth/signin')
        .send(credentialsAdmin)
        .expect(200)
        .end((signinErr) => {
          if (signinErr) {
            return done(signinErr);
          }

          agent.post('/api/admin/users')
            .send({ 'search': 'user-regular' })
            .expect(200)
            .end((err, res) => {
              res.body.length.should.equal(1);
              res.body[0].username.should.equal('user-regular');
              return done(err);
            });
        });
    });

    it('should find by email', (done) => {
      agent.post('/api/auth/signin')
        .send(credentialsAdmin)
        .expect(200)
        .end((signinErr) => {
          if (signinErr) {
            return done(signinErr);
          }

          agent.post('/api/admin/users')
            .send({ 'search': 'regular@example.com' })
            .expect(200)
            .end((err, res) => {
              res.body.length.should.equal(1);
              res.body[0].email.should.equal('regular@example.com');
              return done(err);
            });
        });
    });
  });

  describe('Get user by ID', () => {
    it('non-authenticated users should not be allowed to query', (done) => {
      agent.post('/api/admin/user')
        .send({ id: userRegularId })
        .expect(403)
        .end((err, res) => {
          res.body.message.should.equal('Forbidden.');
          return done(err);
        });
    });

    it('non-admin users should not be allowed to query', (done) => {
      agent.post('/api/auth/signin')
        .send(credentialsRegular)
        .expect(200)
        .end((signinErr) => {
          if (signinErr) {
            return done(signinErr);
          }

          agent.post('/api/admin/user')
            .send({ id: userRegularId })
            .expect(403)
            .end((err, res) => {
              res.body.message.should.equal('Forbidden.');
              return done(err);
            });
        });
    });

    it('admin users should be allowed to query and get correct result', (done) => {
      agent.post('/api/auth/signin')
        .send(credentialsAdmin)
        .expect(200)
        .end((signinErr) => {
          if (signinErr) {
            return done(signinErr);
          }

          agent.post('/api/admin/user')
            .send({ id: userRegularId })
            .expect(200)
            .end((err, res) => {
              res.body.username.should.equal('user-regular');
              // These should have been removed
              should.not.exist(res.body.password);
              should.not.exist(res.body.salt);
              // These should have been obfuscated
              res.body.emailToken.should.equal('(Hidden from admins.)');
              res.body.removeProfileToken.should.equal('(Hidden from admins.)');
              res.body.resetPasswordToken.should.equal('(Hidden from admins.)');
              return done(err);
            });
        });
    });

    it('missing id should return no users', (done) => {
      agent.post('/api/auth/signin')
        .send(credentialsAdmin)
        .expect(200)
        .end((signinErr) => {
          if (signinErr) {
            return done(signinErr);
          }

          agent.post('/api/admin/user')
            .send({ id: '' })
            .expect(400)
            .end((err, res) => {
              res.body.message.should.equal('Cannot interpret id.');
              return done(err);
            });
        });
    });

    it('invalid id should return no users', (done) => {
      agent.post('/api/auth/signin')
        .send(credentialsAdmin)
        .expect(200)
        .end((signinErr) => {
          if (signinErr) {
            return done(signinErr);
          }

          agent.post('/api/admin/user')
            .send({ id: '123' })
            .expect(400)
            .end((err, res) => {
              res.body.message.should.equal('Cannot interpret id.');
              return done(err);
            });
        });
    });
  });

  afterEach((done) => {
    User.deleteMany().exec(done);
  });

});
