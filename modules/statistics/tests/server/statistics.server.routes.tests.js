'use strict';

var should = require('should'),
    request = require('supertest'),
    path = require('path'),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Offer = mongoose.model('Offer'),
    express = require(path.resolve('./config/lib/express'));

/**
 * Globals
 */
var app,
    agent,
    credentials,
    user1,
    user2,
    user3,
    offer;

/**
 * Statistics routes tests
 */
describe('Statistics CRUD tests', function () {

  before(function () {
    // Get application
    app = express.init(mongoose.connection);
    agent = request.agent(app);
  });

  describe('Reading statistics', function () {

    before(function (done) {
      // Create user credentials
      credentials = {
        username: 'loremipsum',
        password: 'Password123!'
      };

      // Create a new user NON-public user
      user1 = new User({
        firstName: 'Full',
        lastName: 'Name',
        displayName: 'Full Name',
        email: 'test1@test.com',
        username: credentials.username,
        password: credentials.password,
        provider: 'local',
        newsletter: true,
        public: false,
        extSitesCS: 'username1',
        extSitesBW: 'username1',
        extSitesWS: '1231231'
      });

      // Create a new user public user
      user2 = new User({
        firstName: 'Full',
        lastName: 'Name',
        displayName: 'Full Name',
        email: 'test2@test.com',
        username: credentials.username + '2',
        password: credentials.password,
        provider: 'local',
        newsletter: true,
        public: true,
        extSitesCS: 'username2',
        extSitesBW: 'username2',
        extSitesWS: '12312312'
      });

      // Create a new user public user without extSites and without newsletter
      user3 = new User({
        firstName: 'Full',
        lastName: 'Name',
        displayName: 'Full Name',
        email: 'test3@test.com',
        username: credentials.username + '3',
        password: credentials.password,
        provider: 'local',
        newsletter: false,
        public: true,
        extSitesCS: 'username3',
        additionalProvidersData: {
          facebook: {
            username: 'username3'
          },
          twitter: {
            username: 'username3'
          },
          github: {
            username: 'username3'
          }
        },
        extSitesBW: ''
      });

      offer = {
        description: '',
        noOfferDescription: '',
        maxGuests: 1,
        type: 'host',
        updated: new Date(),
        location: [52.498981209298776, 13.418329954147339],
        locationFuzzy: [52.50155039101136, 13.42255019882177]
      };

      // Save users and offers to the test db
      user1.save(function (err, user1res) {
        should.not.exist(err);
        offer.user = user1res._id;
        offer.status = 'yes';
        new Offer(offer).save(function (err) {
          should.not.exist(err);
          user2.save(function (err, user2res) {
            should.not.exist(err);
            offer.user = user2res._id;
            offer.status = 'maybe';
            new Offer(offer).save(function (err) {
              should.not.exist(err);
              user3.save(function (err, user3res) {
                should.not.exist(err);
                offer.user = user3res._id;
                offer.status = 'no';
                new Offer(offer).save(function (err) {
                  should.not.exist(err);
                  return done();
                });
              });
            });
          });
        });
      });

    });

    it('should be able to read statistics when not logged in', function (done) {

      // Read statistics
      agent.get('/api/statistics')
        .expect(200)
        .end(function (statsReadErr, statsReadRes) {

          statsReadRes.body.connected.bewelcome.should.equal(1);
          statsReadRes.body.connected.couchsurfing.should.equal(2);
          statsReadRes.body.connected.warmshowers.should.equal(1);
          statsReadRes.body.connected.facebook.should.equal(1);
          statsReadRes.body.connected.twitter.should.equal(1);
          statsReadRes.body.connected.github.should.equal(1);

          statsReadRes.body.hosting.maybe.should.equal(1);
          statsReadRes.body.hosting.yes.should.equal(1);
          should.not.exist(statsReadRes.body.hosting.no);

          statsReadRes.body.total.should.equal(2);
          statsReadRes.body.newsletter.should.equal(1);
          should.exist(statsReadRes.body.commit);

          // Call the assertion callback
          return done(statsReadErr);
        });
    });

    it('should be able to read statistics when logged in', function (done) {
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Read statistics
          agent.get('/api/statistics')
            .expect(200)
            .end(function (statsReadErr, statsReadRes) {

              statsReadRes.body.connected.bewelcome.should.equal(1);
              statsReadRes.body.connected.couchsurfing.should.equal(2);
              statsReadRes.body.connected.warmshowers.should.equal(1);
              statsReadRes.body.connected.facebook.should.equal(1);
              statsReadRes.body.connected.twitter.should.equal(1);
              statsReadRes.body.connected.github.should.equal(1);

              statsReadRes.body.hosting.maybe.should.equal(1);
              statsReadRes.body.hosting.yes.should.equal(1);
              should.not.exist(statsReadRes.body.hosting.no);

              statsReadRes.body.total.should.equal(2);
              statsReadRes.body.newsletter.should.equal(1);
              should.exist(statsReadRes.body.commit);

              // Call the assertion callback
              return done(statsReadErr);
            });

        });
    });

    after(function (done) {
      // Clean out
      User.remove().exec(function () {
        Offer.remove().exec(done);
      });
    });
  });

  describe('Writing statistics', function () {

    it('should be able to write to statistics endpoint', function (done) {

      // Write statistics
      agent.post('/api/statistics')
        .send({
          collection: 'mobileAppInit',
          stats: {
            version: '1.0.0',
            deviceYearClass: '2015',
            expoVersion: '21.0.0',
            os: 'android'
          }
        })
        // .expect(200)
        .end(function (statsWriteErr, statsWriteRes) {
          if (statsWriteErr) {
            return done(statsWriteErr);
          }

          statsWriteRes.body.message.should.equal('OK');
          statsWriteRes.headers.should.not.have.property('x-tr-update-needed');

          // Call the assertion callback
          return done();
        });

    });

    it('should return update header with invalid collection value', function (done) {

      // Write statistics
      agent.post('/api/statistics')
        .send({
          collection: 'WRONG',
          stats: {
            version: '1.0.0',
            deviceYearClass: '2015',
            expoVersion: '21.0.0',
            os: 'android'
          }
        })
        .expect(400)
        .end(function (statsWriteErr, statsWriteRes) {
          if (statsWriteErr) {
            return done(statsWriteErr);
          }

          statsWriteRes.body.message.should.equal('Missing or invalid `collection`.');
          statsWriteRes.headers.should.have.property('x-tr-update-needed');
          statsWriteRes.headers['x-tr-update-needed'].should.equal('You should update Trustroots app or otherwise it will not continue functioning.');

          // Call the assertion callback
          return done();
        });

    });

    it('should return update header with old app version', function (done) {

      // Write statistics
      agent.post('/api/statistics')
        .send({
          collection: 'mobileAppInit',
          stats: {
            version: '0.1.0',
            deviceYearClass: '2015',
            expoVersion: '21.0.0',
            os: 'android'
          }
        })
        .expect(200)
        .end(function (statsWriteErr, statsWriteRes) {
          if (statsWriteErr) {
            return done(statsWriteErr);
          }

          statsWriteRes.body.message.should.equal('You should update Trustroots app or otherwise it will not continue functioning.');
          statsWriteRes.headers.should.have.property('x-tr-update-needed');
          statsWriteRes.headers['x-tr-update-needed'].should.equal('You should update Trustroots app or otherwise it will not continue functioning.');

          // Call the assertion callback
          return done();
        });

    });
  });

});
