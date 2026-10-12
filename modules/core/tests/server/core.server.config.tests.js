/**
 * Module dependencies.
 */
const mongoose = require('mongoose');
const request = require('supertest');
const express = require('./../../../../config/lib/express.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');
const Tribe = mongoose.model('Tribe');

/**
 * Globals
 */
let app;
let agent;
let user;
let userId;
let credentials;
describe('Configuration Tests:', function () {
  describe('avatar staging static-file guard', function () {
    it('denies staging paths before public static middleware', function () {
      const middleware = [];
      express.initModulesClientRoutes({
        use: (...args) => middleware.push(args),
      });
      middleware[0][0].should.equal(express.denyAvatarStagingRequests);
      const res = {
        sendStatus: status => {
          res.statusCode = status;
          return res;
        },
      };
      let nextCalled = false;
      express.denyAvatarStagingRequests(
        {
          path: '/uploads-profile/member/avatar/%2Estaging-secret/128.jpg',
        },
        res,
        () => {
          nextCalled = true;
        },
      );
      res.statusCode.should.equal(404);
      nextCalled.should.be.false();
    });
    it('allows ordinary static paths through the staging guard', function () {
      let nextCalled = false;
      express.denyAvatarStagingRequests(
        {
          path: '/uploads-profile/member/avatar/version/128.jpg',
        },
        {
          sendStatus: () => {},
        },
        () => {
          nextCalled = true;
        },
      );
      nextCalled.should.be.true();
    });
  });
  describe('Exposing authenticated user to pages', function () {
    before(function (done) {
      (async () => {
        app = await express.init(mongoose.connection);
        agent = request.agent(app);
        done();
      })().catch(done);
    });
    beforeEach(function (done) {
      credentials = {
        username: 'helloworld',
        password: 'M3@n.jsI$Aw3$0m3',
      };

      // Create a new user
      user = utils.createTestUser({
        lastName: 'Name A',
        displayName: 'Full Name A',
        email: 'user_a@example.com',
        username: credentials.username,
        password: credentials.password,
      });

      // Save a user to the test db
      user.save(function (saveErr, saveRes) {
        // Handle save error
        if (saveErr) {
          return done(saveErr);
        }
        userId = saveRes._id;
        return done();
      });
    });
    afterEach(utils.clearDatabase);
    it('should have user set to "null" if not authenticated and loading index page', function (done) {
      // Get rendered layout
      agent
        .get('/')
        .expect('Content-Type', 'text/html; charset=utf-8')
        .expect(200)
        .end(function (err, res) {
          // Handle errors
          if (err) {
            return done(err);
          }
          res.text.should.containEql('user = null');
          return done();
        });
    });
    it('should have user set to user object when authenticated and loading index page', function (done) {
      // Authenticate user
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          // Get rendered layout
          agent
            .get('/')
            .expect('Content-Type', 'text/html; charset=utf-8')
            .expect(200)
            .end(function (err, res) {
              // Handle errors
              if (err) {
                return done(err);
              }

              // The user we just created should be exposed
              res.text.should.match(
                new RegExp('user = \\{.*"_id":"' + userId + '"'),
              );
              return done();
            });
        });
    });
    it('should allow an authenticated user to load the Naturists circle', function (done) {
      // Create a new tribe
      const _tribe = {
        slug: 'naturists',
        label: 'Naturists',
        tribe: true,
      };
      const tribe = new Tribe(_tribe);

      // Save a user to the test db
      tribe.save(function (saveErr) {
        // Handle save error
        if (saveErr) {
          return done(saveErr);
        }

        // Authenticate user
        agent
          .post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            // Handle signin error
            if (signinErr) {
              return done(signinErr);
            }

            // Get rendered layout
            agent
              .get('/circles/naturists')
              .expect('Content-Type', 'text/html; charset=utf-8')
              .expect(200)
              .end(function (err, res) {
                // Handle errors
                if (err) {
                  return done(err);
                }

                // The user we just created should be exposed
                res.text.should.match(
                  new RegExp('user = \\{.*"_id":"' + userId + '"'),
                );
                Tribe.deleteMany().exec(done);
              });
          });
      });
    });
  });
  describe('Exposing environment as a variable to layout', function () {
    ['development', 'production', 'test'].forEach(function (env) {
      it('should expose environment set to ' + env, function (done) {
        (async () => {
          // Set env to development for this test
          process.env.NODE_ENV = env;

          // Get application
          app = await express.init(mongoose.connection);
          agent = request.agent(app);

          // Get rendered layout
          agent
            .get('/')
            .expect('Content-Type', 'text/html; charset=utf-8')
            .expect(200)
            .end(function (err, res) {
              // Handle errors
              if (err) {
                return done(err);
              }
              res.text.should.containEql('env = "' + env + '"');
              return done();
            });
        })().catch(done);
      });
    });
    afterEach(function () {
      // Set env back to test
      process.env.NODE_ENV = 'test';
    });
  });
});
