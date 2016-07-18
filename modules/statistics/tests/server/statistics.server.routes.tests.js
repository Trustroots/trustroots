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
var app, agent, credentials, user1, user2, user3, offer;

/**
 * Statistics routes tests
 */
describe('Statistics CRUD tests', function() {

  before(function(done) {
    // Get application
    app = express.init(mongoose);
    agent = request.agent(app);

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
      extSitesBW: ''
    });

    offer = {
      description: '',
      noOfferDescription: '',
      maxGuests: 1,
      updated: new Date(),
      location: [52.498981209298776, 13.418329954147339],
      locationFuzzy: [52.50155039101136, 13.42255019882177]
    };

    // Save users and offers to the test db
    user1.save(function(err, user1res) {
      offer.user = user1res._id;
      offer.status = 'yes';
      new Offer(offer).save(function(err) {
        user2.save(function(err, user2res) {
          offer.user = user2res._id;
          offer.status = 'maybe';
          new Offer(offer).save(function(err) {
            user3.save(function(err, user3res) {
              offer.user = user3res._id;
              offer.status = 'no';
              new Offer(offer).save(function(err) {
                return done();
              });
            });
          });
        });
      });
    });

  });

  it('should be able to read statistics when not logged in', function(done) {

    // Read statistics
    agent.get('/api/statistics')
      .expect(200)
      .end(function(statsReadErr, statsReadRes) {

        statsReadRes.body.connected.bewelcome.should.equal(1);
        statsReadRes.body.connected.couchsurfing.should.equal(2);
        statsReadRes.body.connected.warmshowers.should.equal(1);
        statsReadRes.body.connected.facebook.should.equal(0);
        statsReadRes.body.connected.twitter.should.equal(0);
        statsReadRes.body.connected.github.should.equal(0);

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

  it('should be able to read statistics when logged in', function(done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function(signinErr, signinRes) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Read statistics
        agent.get('/api/statistics')
          .expect(200)
          .end(function(statsReadErr, statsReadRes) {

            statsReadRes.body.connected.bewelcome.should.equal(1);
            statsReadRes.body.connected.couchsurfing.should.equal(2);
            statsReadRes.body.connected.warmshowers.should.equal(1);
            statsReadRes.body.connected.facebook.should.equal(0);
            statsReadRes.body.connected.twitter.should.equal(0);
            statsReadRes.body.connected.github.should.equal(0);

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

  after(function(done) {
    // Clean out
    User.remove().exec(function() {
      Offer.remove().exec(done);
    });
  });
});
