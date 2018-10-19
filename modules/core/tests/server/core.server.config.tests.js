'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    path = require('path'),
    request = require('supertest'),
    express = require(path.resolve('./config/lib/express')),
    mongoose = require('mongoose'),
    Tribe = mongoose.model('Tribe'),
    User = mongoose.model('User');

/**
 * Globals
 */
var app,
    agent,
    _user,
    user,
    userId,
    credentials;

describe('Configuration Tests:', function () {

  describe('Exposing authenticated user to pages', function () {

    beforeEach(function (done) {
      // Get application
      app = express.init(mongoose.connection);
      agent = request.agent(app);
      done();
    });

    beforeEach(function (done) {
      credentials = {
        username: 'helloworld',
        password: 'M3@n.jsI$Aw3$0m3'
      };

      // Create a new user
      _user = {
        public: true,
        firstName: 'Full',
        lastName: 'Name A',
        displayName: 'Full Name A',
        email: 'user_a@example.com',
        username: credentials.username,
        displayUsername: credentials.username,
        password: credentials.password,
        provider: 'local'
      };

      user = new User(_user);

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

    it('should have user set to "null" if not authenticated and loading index page', function (done) {

      // Get rendered layout
      agent.get('/')
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
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }

          // Get rendered layout
          agent.get('/')
            .expect('Content-Type', 'text/html; charset=utf-8')
            .expect(200)
            .end(function (err, res) {
              // Handle errors
              if (err) {
                return done(err);
              }

              // The user we just created should be exposed
              res.text.should.match(new RegExp('user = \\{.*"_id":"' + userId + '"'));

              return done();
            });
        });

    });

    it('should have user set to user object when authenticated and loading tribe page', function (done) {

      // Create a new tribe
      var _tribe = {
        slug: 'testers',
        label: 'Testers',
        tribe: true
      };

      var tribe = new Tribe(_tribe);

      // Save a user to the test db
      tribe.save(function (saveErr) {
        // Handle save error
        if (saveErr) {
          return done(saveErr);
        }

        // Authenticate user
        agent.post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            // Handle signin error
            if (signinErr) {
              return done(signinErr);
            }

            // Get rendered layout
            agent.get('/tribes/testers')
              .expect('Content-Type', 'text/html; charset=utf-8')
              .expect(200)
              .end(function (err, res) {
                // Handle errors
                if (err) {
                  return done(err);
                }

                // The user we just created should be exposed
                res.text.should.match(new RegExp('user = \\{.*"_id":"' + userId + '"'));

                Tribe.remove().exec(done);
              });
          });
      });

    });

    afterEach(function (done) {
      User.remove().exec(done);
    });

  });

  describe('Exposing environment as a variable to layout', function () {

    ['development', 'production', 'test'].forEach(function (env) {
      it('should expose environment set to ' + env, function (done) {
        // Set env to development for this test
        process.env.NODE_ENV = env;

        // Get application
        app = express.init(mongoose.connection);
        agent = request.agent(app);

        // Get rendered layout
        agent.get('/')
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
      });
    });

    afterEach(function () {
      // Set env back to test
      process.env.NODE_ENV = 'test';
    });

  });

});
