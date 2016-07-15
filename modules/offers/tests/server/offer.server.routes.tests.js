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
var app, agent, credentials, user1, user2, user1Id, user2Id, offer1, offer2;

/**
 * Offer routes tests
 */
describe('Offer CRUD tests', function() {

  before(function(done) {
    // Get application
    app = express.init(mongoose);
    agent = request.agent(app);

    done();
  });

  beforeEach(function(done) {
    // Create userFrom credentials
    credentials = {
      username: 'loremipsum',
      password: 'Password123!'
    };

    // Create a new user
    user1 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test1@test.com',
      username: credentials.username,
      password: credentials.password,
      provider: 'local',
      public: true
    });

    // Create a new user
    user2 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test2@test.com',
      username: credentials.username + '2',
      password: credentials.password,
      provider: 'local',
      public: true
    });

    // Used only for sending via POST and thus doesn't include some data
    offer1 = {
      status: 'yes',
      description: '<p>1 I can host! :)</p>',
      noOfferDescription: '<p>1 I cannot host... :(</p>',
      maxGuests: 5,
      location: [52.48556355813466, 13.489011526107788]
    };

    offer2 = new Offer({
      status: 'yes',
      description: '<p>2 I can host! :)</p>',
      noOfferDescription: '<p>2 I cannot host... :(</p>',
      maxGuests: 3,
      updated: new Date(),
      location: [52.498981209298776, 13.418329954147339],
      locationFuzzy: [52.50155039101136, 13.42255019882177]
    });

    // Save user to the test db
    user1.save(function(err) {
      user2.save(function(err) {
        // Check id for user1
        User.findOne({'username': user1.username}, function(err, user1) {
          user1Id = user1._id;
          // Check id for user2
          User.findOne({'username': user1.username}, function(err, user2) {
            user2Id = user2._id;
            offer2.user = user2Id;
            offer2.save(function(err) {
              return done();
            });
          });
        });
      });
    });
  });

  it('should not be able to read offer if not logged in', function(done) {

    agent.get('/api/offers-by/' + user2Id)
      .expect(403)
      .end(function(offerSaveErr, offerSaveRes) {

        offerSaveRes.body.message.should.equal('Forbidden.');

        // Call the assertion callback
        return done(offerSaveErr);
      });
  });

  it('should be able to read offers of other users when logged in', function(done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function(signinErr, signinRes) {
        // Handle signin error
        if (signinErr) done(signinErr);

          // Get a offer from the other user
          agent.get('/api/offers-by/' + user2Id)
            .expect(200)
            .end(function(offerGetErr, offerGetRes) {
              // Handle offer get error
              if (offerGetErr) done(offerGetErr);

              // Set assertions
              offerGetRes.body.user.should.equal(user2Id.toString());
              offerGetRes.body.status.should.equal(offer2.status);
              offerGetRes.body.description.should.equal(offer2.description);
              offerGetRes.body.noOfferDescription.should.equal(offer2.noOfferDescription);
              offerGetRes.body.maxGuests.should.equal(offer2.maxGuests);
              offerGetRes.body.location.should.be.instanceof(Array).and.have.lengthOf(2);
              offerGetRes.body.location.should.deepEqual([offer2.location[0], offer2.location[1]]);
              offerGetRes.body.updated.should.not.be.empty();
              should.not.exist(offerGetRes.body.locationFuzzy);

              // Call the assertion callback
              return done();
            });

      });
  });

  it('should not be able to save offer if not logged in', function(done) {
    agent.post('/api/offers')
      .send(offer1)
      .expect(403)
      .end(function(offerSaveErr, offerSaveRes) {

        offerSaveRes.body.message.should.equal('Forbidden.');

        // Call the assertion callback
        return done(offerSaveErr);
      });
  });

  it('should be able to save offer if logged in', function(done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function(signinErr, signinRes) {
        // Handle signin error
        if (signinErr) done(signinErr);

        // Save a new offer
        agent.post('/api/offers')
          .send(offer1)
          .expect(200)
          .end(function(offerSaveErr, offerSaveRes) {
            // Handle offer save error
            if (offerSaveErr) done(offerSaveErr);

            // Get a offer
            agent.get('/api/offers-by/' + user1Id)
              .expect(200)
              .end(function(offerGetErr, offerGetRes) {
                // Handle offer get error
                if (offerGetErr) done(offerGetErr);

                // Set assertions
                offerGetRes.body.user.should.equal(user1Id.toString());
                offerGetRes.body.status.should.equal(offer1.status);
                offerGetRes.body.description.should.equal(offer1.description);
                offerGetRes.body.noOfferDescription.should.equal(offer1.noOfferDescription);
                offerGetRes.body.maxGuests.should.equal(offer1.maxGuests);
                offerGetRes.body.location.should.be.instanceof(Array).and.have.lengthOf(2);
                offerGetRes.body.location.should.deepEqual([offer1.location[0], offer1.location[1]]);
                offerGetRes.body.updated.should.not.be.empty();

                // Call the assertion callback
                return done();
              });
          });
      });
  });

  it('should be able to save offer without status and status should default to "no"', function(done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function(signinErr, signinRes) {
        // Handle signin error
        if (signinErr) done(signinErr);

        var offerWithoutStatus = offer1;
        delete offerWithoutStatus.status;

        // Save a new offer
        agent.post('/api/offers')
          .send(offerWithoutStatus)
          .expect(200)
          .end(function(offerSaveErr, offerSaveRes) {

            offerSaveRes.body.user._id.should.equal(user1Id.toString());
            offerSaveRes.body.status.should.equal('no');

            // Call the assertion callback
            return done(offerSaveErr);
          });
      });
  });

  it('should not be able to get list of offers from an area if not logged in', function(done) {
    // Get offers (around Berlin)
    agent.get('/api/offers' +
        '?northEastLat=55.31212135084999' +
        '&northEastLng=18.73318142361111' +
        '&southWestLat=44.66407507240992' +
        '&southWestLng=3.689914279513889'
      )
      .expect(403)
      .end(function(offersGetErr, offersGetRes) {
        // Handle offer get error
        if (offersGetErr) done(offersGetErr);

        offersGetRes.body.message.should.equal('Forbidden.');

        // Call the assertion callback
        return done();
      });
  });

  it('should be able to get list of offers from an area', function(done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function(signinErr, signinRes) {
        // Handle signin error
        if (signinErr) done(signinErr);

            // Get offers (around Berlin)
            agent.get('/api/offers' +
                '?northEastLat=55.31212135084999' +
                '&northEastLng=18.73318142361111' +
                '&southWestLat=44.66407507240992' +
                '&southWestLng=3.689914279513889'
              )
              .expect(200)
              .end(function(offersGetErr, offersGetRes) {
                // Handle offer get error
                if (offersGetErr) done(offersGetErr);

                // Set assertions
                offersGetRes.body.length.should.equal(1);
                offersGetRes.body[0].user.should.equal(user2Id.toString());
                offersGetRes.body[0].status.should.equal(offer2.status);
                offersGetRes.body[0].locationFuzzy.should.be.instanceof(Array).and.have.lengthOf(2);
                offersGetRes.body[0].locationFuzzy.should.deepEqual([offer2.locationFuzzy[0], offer2.locationFuzzy[1]]);
                offersGetRes.body[0]._id.should.not.be.empty();

                // Call the assertion callback
                return done();
              });

      });
  });

  it('should be able to get empty list from an area where ther are no offers', function(done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function(signinErr, signinRes) {
        // Handle signin error
        if (signinErr) done(signinErr);

            // Get offers (in Niger)
            agent.get('/api/offers' +
                '?northEastLat=32.89472514359572' +
                '&northEastLng=25.598493303571427' +
                '&southWestLat=-20.49068931208608' +
                '&southWestLng=-12.986188616071427'
              )
              .expect(200)
              .end(function(offersGetErr, offersGetRes) {
                // Handle offer get error
                if (offersGetErr) done(offersGetErr);

                // Set assertions
                offersGetRes.body.length.should.equal(0);

                // Call the assertion callback
                return done();
              });

      });
  });

  afterEach(function(done) {
    // Uggggly pyramid revenge!
    User.remove().exec(function() {
      Offer.remove().exec(done);
    });
  });
});
