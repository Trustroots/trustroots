'use strict';

var _ = require('lodash'),
    should = require('should'),
    request = require('supertest'),
    path = require('path'),
    async = require('async'),
    moment = require('moment'),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Offer = mongoose.model('Offer'),
    Tribe = mongoose.model('Tribe'),
    express = require(path.resolve('./config/lib/express'));

/**
 * Globals
 */
var app,
    agent,
    credentials,
    credentials2,
    user1,
    user2,
    user3,
    user2Id,
    user3Id,
    offer1,
    offer2,
    offer2Id,
    offer3,
    offer3Id,
    offerMeet,
    tribe1,
    tribe2,
    tribe1Id,
    tribe2Id;

var testLocations = {
  'Europe': {
    queryBoundingBox:
      '?northEastLat=55.31212135084999' +
      '&northEastLng=18.73318142361111' +
      '&southWestLat=44.66407507240992' +
      '&southWestLng=3.689914279513889',
    location: [52.48556355813466, 13.489011526107788]
  },
  'China': {
    queryBoundingBox:
      '?northEastLat=68.58321725728176' +
      '&northEastLng=151.23828125000003' +
      '&southWestLat=-3.9332268264771106' +
      '&southWestLng=61.63281250000001',
    location: [34.632532, 103.767519]
  },
  'US': {
    queryBoundingBox:
      '?northEastLat=70.1061015189654' +
      '&northEastLng=-48.44921875000001' +
      '&southWestLat=0.021065118766989688' +
      '&southWestLng=-138.05468750000003',
    location: [40.514402, -88.990735]
  },
  'NorthPole': {
    queryBoundingBox:
      '?northEastLat=89.99703020040681' +
      '&northEastLng=145.61328125000003' +
      '&southWestLat=78.02765497223292' +
      '&southWestLng=56.00781250000001',
    location: [80.912672, 79.732322]
  }
};


/**
 * Offer routes tests
 */
describe('Offer search tests', function () {

  before(function (done) {
    // Get application
    app = express.init(mongoose.connection);
    agent = request.agent(app);

    done();
  });

  beforeEach(function (doneBeforeEach) {
    // Create user credentials
    credentials = {
      username: 'loremipsum',
      password: 'Password123!'
    };

    // Create user2 credentials
    credentials2 = {
      username: 'loremipsum2',
      password: 'Password123!'
    };

    // Create a new user
    user1 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test1@test.com',
      member: [],
      username: credentials.username,
      password: credentials.password,
      provider: 'local',
      public: true,
      seen: new Date()
    });

    // Create a new user
    user2 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test2@test.com',
      member: [],
      username: credentials2.username,
      password: credentials2.password,
      languages: ['fin', 'ita'],
      provider: 'local',
      public: true,
      seen: new Date()
    });

    // Create a new user
    user3 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test3@test.com',
      username: credentials.username + '3',
      password: credentials.password,
      languages: ['ita'],
      provider: 'local',
      public: true,
      seen: new Date()
    });

    // Used only for sending via POST and thus doesn't include some data
    offer1 = {
      type: 'host',
      status: 'yes',
      description: '<p>1 I can host! :)</p>',
      noOfferDescription: '<p>1 I cannot host... :(</p>',
      maxGuests: 5,
      location: testLocations.Europe.location
    };

    offer2 = new Offer({
      type: 'host',
      status: 'yes',
      description: '<p>2 I can host! :)</p>',
      noOfferDescription: '<p>2 I cannot host... :(</p>',
      maxGuests: 3,
      updated: new Date(),
      location: [52.498981209298776, 13.418329954147339]
    });

    offer3 = new Offer({
      type: 'host',
      status: 'yes',
      description: '<p>3 I can host! :)</p>',
      noOfferDescription: '<p>3 I cannot host... :(</p>',
      maxGuests: 1,
      updated: new Date(),
      location: [52.498981209298775, 13.418329954147338]
    });

    offerMeet = new Offer({
      type: 'meet',
      description: '<p>Dinner party!</p>',
      validUntil: moment().add(30, 'day').toDate(),
      updated: new Date(),
      location: [52.498981209298887, 13.418329954147449]
    });

    tribe1 = new Tribe({
      'slug': 'tribe1',
      'label': 'tribe1',
      'color': '111111',
      'tribe': true,
      'count': 1,
      'public': true
    });

    tribe2 = new Tribe({
      'slug': 'tribe2',
      'label': 'tribe2',
      'color': '222222',
      'count': 1,
      'public': true
    });

    // Save data to the test db
    async.waterfall([
      // Save tribe 1
      function (done) {
        tribe1.save(function (err, tribe1) {
          tribe1Id = tribe1._id;
          done(err);
        });
      },
      // Save tribe 2
      function (done) {
        tribe2.save(function (err, tribe2) {
          tribe2Id = tribe2._id;
          done(err);
        });
      },
      // Save user 1 (without tribe membership)
      function (done) {
        user1.save(function (err) {
          done(err);
        });
      },
      // Save user 2 (with tribe membership)
      function (done) {
        user2.member = [{
          tribe: tribe2Id,
          since: new Date()
        }];
        user2.save(function (err, user2res) {
          user2Id = user2res._id;
          done(err);
        });
      },
      // Save user 3 (with tribe membership)
      function (done) {
        user3.member = [{
          tribe: tribe1Id,
          since: new Date()
        }];
        user3.save(function (err, user3res) {
          user3Id = user3res._id;
          return done(err);
        });
      },
      // Save hosting offer 2
      function (done) {
        offer2.user = user2Id;
        offer2.save(function (err, offer2) {
          offer2Id = offer2._id;
          done(err);
        });
      },
      // Save hosting offer 3
      function (done) {
        offer3.user = user3Id;
        offer3.save(function (err, offer3) {
          offer3Id = offer3._id;
          done(err);
        });
      }
    ], function (err) {
      should.not.exist(err);
      doneBeforeEach(err);
    });
  });

  it('should be able to get empty list from an area where there are no offers', function (done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Get offers (in Niger)
        agent.get('/api/offers' +
            '?northEastLat=32.89472514359572' +
            '&northEastLng=25.598493303571427' +
            '&southWestLat=-20.49068931208608' +
            '&southWestLng=-12.986188616071427'
        )
          .expect(200)
          .end(function (offersGetErr, offersGetRes) {
            // Handle offer get error
            if (offersGetErr) return done(offersGetErr);

            // Set assertions
            offersGetRes.body.length.should.equal(0);

            // Call the assertion callback
            return done();
          });

      });
  });

  it('should be able to use + in front of positive coordinates', function (done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Get offers (in Niger)
        agent.get('/api/offers' +
            '?northEastLat=+55.31212135084999' +
            '&northEastLng=+18.73318142361111' +
            '&southWestLat=+44.66407507240992' +
            '&southWestLng=+3.689914279513889'
        )
          .expect(200)
          .end(function (offersGetErr, offersGetRes) {
            // Handle offer get error
            if (offersGetErr) return done(offersGetErr);

            // Set assertions
            offersGetRes.body.length.should.equal(2);

            // Call the assertion callback
            return done();
          });

      });
  });

  it('should return error when missing bounding box parameter', function (done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Missing `southWestLng` paramter
        agent.get('/api/offers' +
            '?northEastLat=32.89472514359572' +
            '&northEastLng=25.598493303571427' +
            '&southWestLat=-20.49068931208608'
        )
          .expect(400)
          .end(done);

      });
  });

  it('should return error with invalid bounding box parameter (string after decimals)', function (done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Missing `southWestLng` paramter
        agent.get('/api/offers' +
            '?northEastLat=25.' + '1'.repeat(30) + 'foo' + // `foo` starts at 31
            '&northEastLng=25.598493303571427' +
            '&southWestLat=-20.49068931208608' +
            '&southWestLng=-12.986188616071427'
        )
          .expect(400)
          .end(done);

      });
  });

  it('should return error with invalid bounding box parameter (string instead of coordinate)', function (done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Missing `southWestLng` paramter
        agent.get('/api/offers' +
            '?northEastLat=FAIL' +
            '&northEastLng=25.598493303571427' +
            '&southWestLat=-20.49068931208608' +
            '&southWestLng=-12.986188616071427'
        )
          .expect(400)
          .end(done);

      });
  });

  it('should not be able to get list of offers from an area if not authenticated', function (done) {
    // Get offers (around Berlin)
    agent.get('/api/offers' + testLocations.Europe.queryBoundingBox)
      .expect(403)
      .end(function (offersGetErr, offersGetRes) {
        // Handle offer get error
        if (offersGetErr) return done(offersGetErr);

        offersGetRes.body.message.should.equal('Forbidden.');

        // Call the assertion callback
        return done();
      });
  });

  it('should be able to get list of offers from an area (Europe)', function (done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Get offers (around Berlin)
        agent.get('/api/offers' + testLocations.Europe.queryBoundingBox)
          .expect(200)
          .end(function (offersGetErr, offersGetRes) {
            // Handle offer get error
            if (offersGetErr) return done(offersGetErr);

            // MongoDb returns these in random order, figure out order here
            var user2Order = 1;
            var user3Order = 0;
            if (offersGetRes.body[0]._id === offer2Id.toString()) {
              user2Order = 0;
              user3Order = 1;
            }

            // Set assertions
            offersGetRes.body.should.be.instanceof(Array).and.have.lengthOf(2);
            offersGetRes.body[user2Order].status.should.equal(offer2.status);
            offersGetRes.body[user2Order].location.should.be.instanceof(Array).and.have.lengthOf(2);
            offersGetRes.body[user2Order].location[0].should.be.approximately(offer2.locationFuzzy[0], 0.0000000000001);
            offersGetRes.body[user2Order].location[1].should.be.approximately(offer2.locationFuzzy[1], 0.0000000000001);
            offersGetRes.body[user2Order]._id.should.equal(offer2Id.toString());
            should.not.exist(offersGetRes.body[user2Order].locationFuzzy);

            offersGetRes.body[user3Order].status.should.equal(offer3.status);
            offersGetRes.body[user3Order].location.should.be.instanceof(Array).and.have.lengthOf(2);
            offersGetRes.body[user3Order].location[0].should.be.approximately(offer3.locationFuzzy[0], 0.0000000000001);
            offersGetRes.body[user3Order].location[1].should.be.approximately(offer3.locationFuzzy[1], 0.0000000000001);
            offersGetRes.body[user3Order]._id.should.equal(offer3Id.toString());
            should.not.exist(offersGetRes.body[user3Order].locationFuzzy);

            // Call the assertion callback
            return done();
          });
      });
  });

  // Tests different regions in the globe (Asia, USA, North Pole etc)
  _.forEach(testLocations, function (testLocation, area) {
    it('should be able to get offer from an area (' + area + ')', function (done) {

      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Clean out the DB from other offers
          Offer.remove().exec(function () {

            // Create new offer to target location
            var testLocationOffer = new Offer(offer1);
            testLocationOffer.location = testLocation.location;

            testLocationOffer.save(function (saveErr, saveRes) {
              if (saveErr) return done(saveErr);

              // Get offers (around Berlin)
              agent.get('/api/offers' + testLocation.queryBoundingBox)
                .expect(200)
                .end(function (offersGetErr, offersGetRes) {
                  // Handle offer get error
                  if (offersGetErr) return done(offersGetErr);

                  // Set assertions
                  offersGetRes.body.should.be.instanceof(Array).and.have.lengthOf(1);
                  offersGetRes.body[0]._id.should.equal(saveRes._id.toString());
                  offersGetRes.body[0].location[0].should.be.approximately(testLocation.location[0], 0.1);
                  offersGetRes.body[0].location[1].should.be.approximately(testLocation.location[1], 0.1);

                  // Call the assertion callback
                  return done();
                });

            });

          });

        });
    });
  });

  it('should include both meet and host offers when getting a list of offers from an area', function (done) {

    offerMeet.save(function (saveErr) {
      // Handle save error
      if (saveErr) return done(saveErr);

      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Get offers (around Berlin)
          agent.get('/api/offers' + testLocations.Europe.queryBoundingBox)
            .expect(200)
            .end(function (offersGetErr, offersGetRes) {
              // Handle offer get error
              if (offersGetErr) return done(offersGetErr);

              // Set assertions

              offersGetRes.body.should.be.instanceof(Array).and.have.lengthOf(3);

              // Count different offer types
              // This produces `{'host': 2, 'meet': 1}`
              var count = _.countBy(offersGetRes.body, function (offer) {
                return offer.type;
              });

              count.host.should.equal(2);
              count.meet.should.equal(1);

              // Call the assertion callback
              return done();
            });
        });
    });
  });

  it('should not include outdated meet offers when getting a list of offers from an area', function (done) {

    // Set date to past
    offerMeet.validUntil = moment().subtract(1, 'minute').toDate();

    offerMeet.save(function (saveErr) {
      // Handle save error
      if (saveErr) return done(saveErr);

      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Get offers (around Berlin)
          agent.get('/api/offers' + testLocations.Europe.queryBoundingBox)
            .expect(200)
            .end(function (offersGetErr, offersGetRes) {
              // Handle offer get error
              if (offersGetErr) return done(offersGetErr);

              // Set assertions
              offersGetRes.body.should.be.instanceof(Array).and.have.lengthOf(2);

              // Only "host" offers here
              // Note that these are in random order from Mongo but it doesn't matter here
              offersGetRes.body[0].type.should.equal('host');
              offersGetRes.body[1].type.should.equal('host');

              // Call the assertion callback
              return done();
            });
        });
    });
  });

  describe('Search offers by "types" filter', function () {

    it('should be able to get list of offers from an area filtered by type "host"', function (done) {
      offerMeet.save(function (saveErr) {
        // Handle save error
        if (saveErr) return done(saveErr);

        agent.post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            // Handle signin error
            if (signinErr) return done(signinErr);

            // Get offers (around Berlin)
            var filters = {
              types: ['host']
            };
            agent.get('/api/offers' + testLocations.Europe.queryBoundingBox + '&filters=' + encodeURIComponent(JSON.stringify(filters)))
              .expect(200)
              .end(function (offersGetErr, offersGetRes) {
                // Handle offer get error
                if (offersGetErr) return done(offersGetErr);

                // MongoDb returns these in random order, figure out order here
                var user2Order = 1;
                var user3Order = 0;
                if (offersGetRes.body[0]._id === offer2Id.toString()) {
                  user2Order = 0;
                  user3Order = 1;
                }

                // Set assertions
                offersGetRes.body.should.be.instanceof(Array).and.have.lengthOf(2);
                offersGetRes.body[user2Order].type.should.equal(offer2.type);
                offersGetRes.body[user3Order].type.should.equal(offer3.type);

                // Call the assertion callback
                return done();
              });
          });
      });
    });

    it('should be able to get list of offers from an area filtered by type "meet"', function (done) {
      offerMeet.save(function (saveErr) {
        // Handle save error
        if (saveErr) return done(saveErr);

        agent.post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            // Handle signin error
            if (signinErr) return done(signinErr);

            // Get offers (around Berlin)
            var filters = {
              types: ['meet']
            };
            agent.get('/api/offers' + testLocations.Europe.queryBoundingBox + '&filters=' + encodeURIComponent(JSON.stringify(filters)))
              .expect(200)
              .end(function (offersGetErr, offersGetRes) {
                // Handle offer get error
                if (offersGetErr) return done(offersGetErr);

                // Set assertions
                offersGetRes.body.should.be.instanceof(Array).and.have.lengthOf(1);
                offersGetRes.body[0].type.should.equal(offerMeet.type);

                // Call the assertion callback
                return done();
              });
          });
      });
    });

    it('should be able to get list of offers from an area filtered by non existing type', function (done) {
      offerMeet.save(function (saveErr) {
        // Handle save error
        if (saveErr) return done(saveErr);

        agent.post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            // Handle signin error
            if (signinErr) return done(signinErr);

            // Get offers (around Berlin)
            var filters = {
              types: ['foobar']
            };
            agent.get('/api/offers' + testLocations.Europe.queryBoundingBox + '&filters=' + encodeURIComponent(JSON.stringify(filters)))
              .expect(200)
              .end(function (offersGetErr, offersGetRes) {
                // Handle offer get error
                if (offersGetErr) return done(offersGetErr);

                // Set assertions
                offersGetRes.body.should.be.instanceof(Array).and.have.lengthOf(3);

                // Count different offer types
                // This produces `{'host': 2, 'meet': 1}`
                var count = _.countBy(offersGetRes.body, function (offer) {
                  return offer.type;
                });

                count.host.should.equal(2);
                count.meet.should.equal(1);

                // Call the assertion callback
                return done();
              });
          });
      });
    });

  });

  describe('Search offers by "languages" filter', function () {

    it('should be able to get list of offers from an area filtered by one language and ignore users by other language', function (done) {
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Get offers (around Berlin)
          var filters = {
            languages: ['fin']
          };

          agent.get('/api/offers' + testLocations.Europe.queryBoundingBox + '&filters=' + encodeURIComponent(JSON.stringify(filters)))
            .expect(200)
            .end(function (offersGetErr, offersGetRes) {
              // Handle offer get error
              if (offersGetErr) return done(offersGetErr);

              // Set assertions
              offersGetRes.body.should.be.instanceof(Array).and.have.lengthOf(1);
              offersGetRes.body[0]._id.should.equal(offer2._id.toString());

              // Call the assertion callback
              return done();
            });
        });
    });

    it('should be able to get list of offers from an area filtered by multiple languages', function (done) {

      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Get offers (around Berlin)
          var filters = {
            languages: ['fin', 'ita']
          };

          agent.get('/api/offers' + testLocations.Europe.queryBoundingBox + '&filters=' + encodeURIComponent(JSON.stringify(filters)))
            .expect(200)
            .end(function (offersGetErr, offersGetRes) {
              // Handle offer get error
              if (offersGetErr) return done(offersGetErr);

              // MongoDb returns these in random order, figure out order here
              var user2Order = 1;
              var user3Order = 0;
              if (offersGetRes.body[0]._id === offer2Id.toString()) {
                user2Order = 0;
                user3Order = 1;
              }

              // Set assertions
              offersGetRes.body.should.be.instanceof(Array).and.have.lengthOf(2);
              offersGetRes.body[user2Order]._id.should.equal(offer2._id.toString());
              offersGetRes.body[user3Order]._id.should.equal(offer3._id.toString());

              // Call the assertion callback
              return done();
            });
        });
    });

  });

  describe('Search offers by "tribes" filter', function () {

    it('should be able to get list of offers from an area filtered by one tribe', function (done) {
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Get offers (around Berlin)
          var filters = {
            tribes: [tribe2Id]
          };
          agent.get('/api/offers' + testLocations.Europe.queryBoundingBox + '&filters=' + encodeURIComponent(JSON.stringify(filters)))
            .expect(200)
            .end(function (offersGetErr, offersGetRes) {
              // Handle offer get error
              if (offersGetErr) return done(offersGetErr);

              // Set assertions
              offersGetRes.body.should.be.instanceof(Array).and.have.lengthOf(1);
              offersGetRes.body[0].status.should.equal(offer2.status);
              offersGetRes.body[0].type.should.equal(offer2.type);
              offersGetRes.body[0].location.should.be.instanceof(Array).and.have.lengthOf(2);
              offersGetRes.body[0].location[0].should.be.approximately(offer2.locationFuzzy[0], 0.0000000000001);
              offersGetRes.body[0].location[1].should.be.approximately(offer2.locationFuzzy[1], 0.0000000000001);
              offersGetRes.body[0]._id.should.equal(offer2Id.toString());
              should.not.exist(offersGetRes.body[0].locationFuzzy);

              // Call the assertion callback
              return done();
            });
        });
    });

    it('should be able to get list of offers from an area filtered by tribes and not get tribe-less offers', function (done) {
      user3.member = [];
      user3.save(function (err, user3res) {
        should.not.exist(err);
        user3res.member.length.should.equal(0);
        agent.post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            // Handle signin error
            if (signinErr) return done(signinErr);

            // Get offers (around Berlin)
            var filters = {
              tribes: [tribe1Id, tribe2Id]
            };
            agent.get('/api/offers' + testLocations.Europe.queryBoundingBox + '&filters=' + encodeURIComponent(JSON.stringify(filters)))
              .expect(200)
              .end(function (offersGetErr, offersGetRes) {
                // Handle offer get error
                if (offersGetErr) return done(offersGetErr);

                // Set assertions
                offersGetRes.body.should.be.instanceof(Array).and.have.lengthOf(1);
                offersGetRes.body[0].status.should.equal(offer2.status);
                offersGetRes.body[0].type.should.equal(offer2.type);
                offersGetRes.body[0].location.should.be.instanceof(Array).and.have.lengthOf(2);
                offersGetRes.body[0].location[0].should.be.approximately(offer2.locationFuzzy[0], 0.0000000000001);
                offersGetRes.body[0].location[1].should.be.approximately(offer2.locationFuzzy[1], 0.0000000000001);

                // Call the assertion callback
                return done();
              });
          });
      });
    });

    it('should be able to get list of offers from an area filtered by many tribes', function (done) {
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Get offers (around Berlin)
          var filters = {
            tribes: [tribe1Id, tribe2Id]
          };
          agent.get('/api/offers' + testLocations.Europe.queryBoundingBox + '&filters=' + encodeURIComponent(JSON.stringify(filters)))
            .expect(200)
            .end(function (offersGetErr, offersGetRes) {
              // Handle offer get error
              if (offersGetErr) return done(offersGetErr);

              // Set assertions
              offersGetRes.body.should.be.instanceof(Array).and.have.lengthOf(2);

              // MongoDb returns these in random order, figure out order here
              var user2Order = 1;
              var user3Order = 0;
              if (offersGetRes.body[0]._id === offer2Id.toString()) {
                user2Order = 0;
                user3Order = 1;
              }

              // User 2 offer
              offersGetRes.body[user2Order].status.should.equal(offer2.status);
              offersGetRes.body[user2Order].type.should.equal(offer2.type);
              offersGetRes.body[user2Order].location.should.be.instanceof(Array).and.have.lengthOf(2);
              offersGetRes.body[user2Order].location[0].should.be.approximately(offer2.locationFuzzy[0], 0.0000000000001);
              offersGetRes.body[user2Order].location[1].should.be.approximately(offer2.locationFuzzy[1], 0.0000000000001);
              offersGetRes.body[user2Order]._id.should.equal(offer2Id.toString());
              should.not.exist(offersGetRes.body[user2Order].locationFuzzy);

              // User 3 offer
              offersGetRes.body[user3Order].status.should.equal(offer3.status);
              offersGetRes.body[user3Order].type.should.equal(offer2.type);
              offersGetRes.body[user3Order].location.should.be.instanceof(Array).and.have.lengthOf(2);
              offersGetRes.body[user3Order].location[0].should.be.approximately(offer3.locationFuzzy[0], 0.0000000000001);
              offersGetRes.body[user3Order].location[1].should.be.approximately(offer3.locationFuzzy[1], 0.0000000000001);
              offersGetRes.body[user3Order]._id.should.equal(offer3Id.toString());
              should.not.exist(offersGetRes.body[user3Order].locationFuzzy);

              // Call the assertion callback
              return done();
            });
        });
    });

    it('should be able able to send empty filter request', function (done) {
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          agent.get('/api/offers' + testLocations.Europe.queryBoundingBox + '&filters=&types=')
            .expect(200)
            .end(function (offersGetErr, offersGetRes) {
              // Handle offer get error
              if (offersGetErr) return done(offersGetErr);

              // Set assertions
              offersGetRes.body.should.be.instanceof(Array).and.have.lengthOf(2);

              // Call the assertion callback
              return done();
            });
        });
    });

    it('should not be able to send non-json filter request', function (done) {
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          agent.get('/api/offers' + testLocations.Europe.queryBoundingBox + '&filters={wrong}')
            .expect(400)
            .end(function (offersGetErr, offersGetRes) {
              // Handle offer get error
              if (offersGetErr) return done(offersGetErr);

              // Set assertions
              offersGetRes.body.message.should.equal('Could not parse filters.');

              // Call the assertion callback
              return done();
            });

        });
    });

  });

  describe('Search offers by "seen" filter', function () {

    it('should be able to get list of offers from an area filtered by last seen', function (done) {
      user2.seen = moment().subtract({ 'months': 2 }).toDate();

      user2.save(function (user2SaveErr) {
        if (user2SaveErr) {
          return done(user2SaveErr);
        }

        agent.post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            // Handle signin error
            if (signinErr) {
              return done(signinErr);
            }

            var filters = {
              seen: {
                'months': 1
              }
            };

            agent.get('/api/offers' + testLocations.Europe.queryBoundingBox + '&filters=' + encodeURIComponent(JSON.stringify(filters)))
              .expect(200)
              .end(function (offersGetErr, offersGetRes) {
                // Handle offer get error
                if (offersGetErr) return done(offersGetErr);

                // Set assertions
                // User2's offer should be filtered out
                offersGetRes.body.should.be.instanceof(Array).and.have.lengthOf(1);
                offersGetRes.body[0]._id.should.equal(offer3Id.toString());

                // Call the assertion callback
                return done();
              });
          });
      });
    });

  });

  afterEach(function (done) {
    User.remove().exec(function () {
      Tribe.remove().exec(function () {
        Offer.remove().exec(done);
      });
    });
  });

});
