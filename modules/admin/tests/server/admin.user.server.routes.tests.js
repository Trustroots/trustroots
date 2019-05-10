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
describe('Admin CRUD tests', () => {

  before((done) => {
    // Get application
    app = express.init(mongoose.connection);
    agent = request.agent(app);

    done();
  });

  beforeEach((done) => {
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
      firstName: 'Admin',
      lastName: 'Name',
      displayName: 'Admin Name',
      email: 'admin@example.com',
      member: [],
      roles: ['user', 'admin'],
      provider: 'local',
      public: true,
      ...credentialsAdmin
    });

    // Create a new regular user
    userRegular = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'regular@example.com',
      member: [],
      roles: ['user'],
      provider: 'local',
      public: true,
      ...credentialsRegular
    });

    userAdmin.save((err) => {
      if (err) {
        return done(err);
      }
      userRegular.save((err, user) => {
        if (err) {
          return done(err);
        }
        userRegularId = user._id;
        return done();
      });
    });
  });

  describe('Search users', () => {
    it('non-authenticated users should not be allowed to search', (done) => {
      agent.get('/api/admin/users/?search=Name')
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

          agent.get('/api/admin/users/?search=Name')
            .expect(403)
            .end((err, res) => {
              res.body.message.should.equal('Forbidden.');
              return done(err);
            });
        });
    });

    it('admin users should be allowed to search', (done) => {
      agent.post('/api/auth/signin')
        .send(credentialsAdmin)
        .expect(200)
        .end((signinErr) => {
          if (signinErr) {
            return done(signinErr);
          }

          agent.get('/api/admin/users/?search=Name')
            .expect(200)
            .end((err, res) => {
              res.body.length.should.equal(2);

              res.body[0].username.should.equal('user-admin');
              should.not.exist(res.body[0].password);
              should.not.exist(res.body[0].salt);

              res.body[1].username.should.equal('user-regular');
              should.not.exist(res.body[1].password);
              should.not.exist(res.body[1].salt);
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

          agent.get('/api/admin/users/?search=user-regular')
            .expect(200)
            .end((err, res) => {
              res.body.length.should.equal(1);
              res.body[0].username.should.equal('user-regular');
              should.not.exist(res.body[0].password);
              should.not.exist(res.body[0].salt);
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

          agent.get('/api/admin/users/?search=regular@example.com')
            .expect(200)
            .end((err, res) => {
              res.body.length.should.equal(1);
              res.body[0].username.should.equal('user-regular');
              should.not.exist(res.body[0].password);
              should.not.exist(res.body[0].salt);
              return done(err);
            });
        });
    });
  });

  describe('Get user by ID', () => {
    it('non-authenticated users should not be allowed to query', (done) => {
      agent.get('/api/admin/user/?id=' + userRegularId)
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

          agent.get('/api/admin/user/?id=' + userRegularId)
            .expect(403)
            .end((err, res) => {
              res.body.message.should.equal('Forbidden.');
              return done(err);
            });
        });
    });

    it('admin users should be allowed to search', (done) => {
      agent.post('/api/auth/signin')
        .send(credentialsAdmin)
        .expect(200)
        .end((signinErr) => {
          if (signinErr) {
            return done(signinErr);
          }

          agent.get('/api/admin/user/?id=' + userRegularId)
            .expect(200)
            .end((err, res) => {
              res.body.username.should.equal('user-regular');
              should.not.exist(res.body.password);
              should.not.exist(res.body.salt);
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

          agent.get('/api/admin/user/?id=')
            .expect(400)
            .end((err, res) => {
              res.body.message.should.equal('Invalid or missing ID.');
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

          agent.get('/api/admin/user/?id=123')
            .expect(400)
            .end((err, res) => {
              res.body.message.should.equal('Invalid or missing ID.');
              return done(err);
            });
        });
    });
  });

  afterEach((done) => {
    User.deleteMany().exec(done);
  });

});
