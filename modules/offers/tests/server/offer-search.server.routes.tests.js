const _ = require('lodash');
require('should');
const request = require('supertest');
const moment = require('moment');
const mongoose = require('mongoose');
const express = require('./../../../../config/lib/express.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');
const User = mongoose.model('User');
const Offer = mongoose.model('Offer');
const Tribe = mongoose.model('Tribe');
/**
 * Globals
 */
let app;
let agent;
let credentials;
let credentials2;
let user1;
let user2;
let user3;
let user2Id;
let user3Id;
let offer1;
let offer2;
let offer2Id;
let offer3;
let offer3Id;
let offerMeet;
let tribe1;
let tribe2;
let tribe1Id;
let tribe2Id;
const testLocations = {
  Europe: {
    queryBoundingBox:
      '?northEastLat=55.31212135084999' +
      '&northEastLng=18.73318142361111' +
      '&southWestLat=44.66407507240992' +
      '&southWestLng=3.689914279513889',
    location: [52.48556355813466, 13.489011526107788],
  },
  China: {
    queryBoundingBox:
      '?northEastLat=68.58321725728176' +
      '&northEastLng=151.23828125000003' +
      '&southWestLat=-3.9332268264771106' +
      '&southWestLng=61.63281250000001',
    location: [34.632532, 103.767519],
  },
  US: {
    queryBoundingBox:
      '?northEastLat=70.1061015189654' +
      '&northEastLng=-48.44921875000001' +
      '&southWestLat=0.021065118766989688' +
      '&southWestLng=-138.05468750000003',
    location: [40.514402, -88.990735],
  },
  NorthPole: {
    queryBoundingBox:
      '?northEastLat=89.99703020040681' +
      '&northEastLng=145.61328125000003' +
      '&southWestLat=78.02765497223292' +
      '&southWestLng=56.00781250000001',
    location: [80.912672, 79.732322],
  },
};

/**
 * Offer routes tests
 */
describe('Offer search tests', function () {
  before(function (done) {
    (async () => {
      // Get application
      app = await express.init(mongoose.connection);
      agent = request.agent(app);
      done();
    })().catch(done);
  });
  beforeEach(async function () {
    // Create user credentials
    credentials = {
      username: 'loremipsum',
      password: 'Password123!',
    };

    // Create user2 credentials
    credentials2 = {
      username: 'loremipsum2',
      password: 'Password123!',
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
      seen: new Date(),
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
      seen: new Date(),
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
      seen: new Date(),
    });

    // Used only for sending via POST and thus doesn't include some data
    offer1 = {
      type: 'host',
      status: 'yes',
      description: '<p>1 I can host! :)</p>',
      noOfferDescription: '<p>1 I cannot host... :(</p>',
      maxGuests: 5,
      location: testLocations.Europe.location,
    };
    offer2 = new Offer({
      type: 'host',
      status: 'yes',
      description: '<p>2 I can host! :)</p>',
      noOfferDescription: '<p>2 I cannot host... :(</p>',
      maxGuests: 3,
      updated: new Date(),
      location: [52.49898120929857, 13.41832995414733],
    });
    offer3 = new Offer({
      type: 'host',
      status: 'yes',
      description: '<p>3 I can host! :)</p>',
      noOfferDescription: '<p>3 I cannot host... :(</p>',
      maxGuests: 1,
      updated: new Date(),
      location: [52.49898120929877, 13.41832995414732],
    });
    offerMeet = new Offer({
      type: 'meet',
      description: '<p>Dinner party!</p>',
      validUntil: moment().add(30, 'day').toDate(),
      updated: new Date(),
      location: [52.49898120929888, 13.41832995414744],
    });
    tribe1 = new Tribe({
      slug: 'tribe1',
      label: 'tribe1',
      color: '111111',
      tribe: true,
      count: 1,
      public: true,
    });
    tribe2 = new Tribe({
      slug: 'tribe2',
      label: 'tribe2',
      color: '222222',
      count: 1,
      public: true,
    });

    // Save data to the test db
    // Save tribe 1
    tribe1Id = (await tribe1.save())._id;
    // Save tribe 2
    tribe2Id = (await tribe2.save())._id;
    // Save user 1 (without tribe membership)
    await user1.save();
    // Save user 2 (with tribe membership)
    user2.member = [
      {
        tribe: tribe2Id,
        since: new Date(),
      },
    ];
    user2Id = (await user2.save())._id;
    // Save user 3 (with tribe membership)
    user3.member = [
      {
        tribe: tribe1Id,
        since: new Date(),
      },
    ];
    user3Id = (await user3.save())._id;
    // Save hosting offer 2
    offer2.user = user2Id;
    offer2Id = (await offer2.save())._id;
    // Save hosting offer 3
    offer3.user = user3Id;
    offer3Id = (await offer3.save())._id;

    // assign users to unsaved offers
    offerMeet.user = user2Id;
    offer1.user = user3Id;
  });
  afterEach(utils.clearDatabase);
  it('should be able to get empty list from an area where there are no offers', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Get offers (in Niger)
        agent
          .get(
            '/api/offers' +
              '?northEastLat=32.89472514359572' +
              '&northEastLng=25.598493303571427' +
              '&southWestLat=-20.49068931208608' +
              '&southWestLng=-12.986188616071427',
          )
          .expect(200)
          .end(function (offersGetErr, offersGetRes) {
            // Handle offer get error
            if (offersGetErr) return done(offersGetErr);

            // Set assertions
            offersGetRes.body.features.length.should.equal(0);

            // Call the assertion callback
            return done();
          });
      });
  });
  it('should be able to use + in front of positive coordinates', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Get offers (in Niger)
        agent
          .get(
            '/api/offers' +
              '?northEastLat=+55.31212135084999' +
              '&northEastLng=+18.73318142361111' +
              '&southWestLat=+44.66407507240992' +
              '&southWestLng=+3.689914279513889',
          )
          .expect(200)
          .end(function (offersGetErr, offersGetRes) {
            // Handle offer get error
            if (offersGetErr) return done(offersGetErr);

            // Set assertions
            offersGetRes.body.features.length.should.equal(2);

            // Call the assertion callback
            return done();
          });
      });
  });
  it('should return error when missing bounding box parameter', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Missing `southWestLng` paramter
        agent
          .get(
            '/api/offers' +
              '?northEastLat=32.89472514359572' +
              '&northEastLng=25.598493303571427' +
              '&southWestLat=-20.49068931208608',
          )
          .expect(400)
          .end(done);
      });
  });
  it('should return error with invalid bounding box parameter (string after decimals)', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Missing `southWestLng` paramter
        agent
          .get(
            '/api/offers' +
              '?northEastLat=25.' +
              '1'.repeat(30) +
              'foo' +
              // `foo` starts at 31
              '&northEastLng=25.598493303571427' +
              '&southWestLat=-20.49068931208608' +
              '&southWestLng=-12.986188616071427',
          )
          .expect(400)
          .end(done);
      });
  });
  it('should return error with invalid bounding box parameter (string instead of coordinate)', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Missing `southWestLng` paramter
        agent
          .get(
            '/api/offers' +
              '?northEastLat=FAIL' +
              '&northEastLng=25.598493303571427' +
              '&southWestLat=-20.49068931208608' +
              '&southWestLng=-12.986188616071427',
          )
          .expect(400)
          .end(done);
      });
  });
  it('should not be able to get list of offers from an area if not authenticated', function (done) {
    // Get offers (around Berlin)
    agent
      .get('/api/offers' + testLocations.Europe.queryBoundingBox)
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
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Get offers (around Berlin)
        agent
          .get('/api/offers' + testLocations.Europe.queryBoundingBox)
          .expect(200)
          .end(function (offersGetErr, offersGetRes) {
            // Handle offer get error
            if (offersGetErr) return done(offersGetErr);

            // Set assertions
            offersGetRes.body.features.should.have.lengthOf(2);

            // MongoDb returns these in random order, figure out order here
            let user2Order = 1;
            let user3Order = 0;
            if (
              offersGetRes.body.features[0].properties.id ===
              offer2Id.toString()
            ) {
              user2Order = 0;
              user3Order = 1;
            }
            const offerA = offersGetRes.body.features[user2Order];
            const offerB = offersGetRes.body.features[user3Order];
            offerA.properties.status.should.equal(offer2.status);
            offerA.geometry.coordinates.should.have.lengthOf(2);
            offerA.geometry.coordinates[0].should.be.approximately(
              offer2.locationFuzzy[1],
              0.0000000000001,
            );
            offerA.geometry.coordinates[1].should.be.approximately(
              offer2.locationFuzzy[0],
              0.0000000000001,
            );
            offerA.properties.id.should.equal(offer2Id.toString());
            offerB.properties.status.should.equal(offer3.status);
            offerB.geometry.coordinates.should.have.lengthOf(2);
            offerB.geometry.coordinates[0].should.be.approximately(
              offer3.locationFuzzy[1],
              0.0000000000001,
            );
            offerB.geometry.coordinates[1].should.be.approximately(
              offer3.locationFuzzy[0],
              0.0000000000001,
            );
            offerB.properties.id.should.equal(offer3Id.toString());

            // Call the assertion callback
            return done();
          });
      });
  });

  // Tests different regions in the globe (Asia, USA, North Pole etc)
  _.forEach(testLocations, function (testLocation, area) {
    it(
      'should be able to get offer from an area (' + area + ')',
      function (done) {
        agent
          .post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            // Handle signin error
            if (signinErr) return done(signinErr);

            // Clean out the DB from other offers
            Offer.deleteMany()
              .exec()
              .then(() => {
                // Create new offer to target location
                const testLocationOffer = new Offer(offer1);
                testLocationOffer.location = testLocation.location;
                testLocationOffer
                  .save()
                  .then(saveRes => {
                    // Get offers (around Berlin)
                    agent
                      .get('/api/offers' + testLocation.queryBoundingBox)
                      .expect(200)
                      .end(function (offersGetErr, offersGetRes) {
                        // Handle offer get error
                        if (offersGetErr) return done(offersGetErr);

                        // Set assertions
                        offersGetRes.body.features.should.have.lengthOf(1);
                        const offerA = offersGetRes.body.features[0];
                        offerA.properties.id.should.equal(
                          saveRes._id.toString(),
                        );
                        offerA.geometry.coordinates[0].should.be.approximately(
                          testLocation.location[1],
                          0.1,
                        );
                        offerA.geometry.coordinates[1].should.be.approximately(
                          testLocation.location[0],
                          0.1,
                        );

                        // Call the assertion callback
                        return done();
                      });
                  })
                  .catch(done);
              })
              .catch(done);
          });
      },
    );
  });
  it('should include both meet and host offers when getting a list of offers from an area', function (done) {
    offerMeet
      .save()
      .then(() => {
        agent
          .post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            // Handle signin error
            if (signinErr) return done(signinErr);

            // Get offers (around Berlin)
            agent
              .get('/api/offers' + testLocations.Europe.queryBoundingBox)
              .expect(200)
              .end(function (offersGetErr, offersGetRes) {
                // Handle offer get error
                if (offersGetErr) return done(offersGetErr);

                // Set assertions
                offersGetRes.body.features.should.have.lengthOf(3);

                // Count different offer types
                // This produces `{'host': 2, 'meet': 1}`
                const count = _.countBy(
                  offersGetRes.body.features,
                  offer => offer.properties.type,
                );
                count.host.should.equal(2);
                count.meet.should.equal(1);

                // Call the assertion callback
                return done();
              });
          });
      })
      .catch(done);
  });
  it('should not include outdated meet offers when getting a list of offers from an area', function (done) {
    // Set date to past
    offerMeet.validUntil = moment().subtract(1, 'minute').toDate();
    offerMeet
      .save()
      .then(() => {
        agent
          .post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            // Handle signin error
            if (signinErr) return done(signinErr);

            // Get offers (around Berlin)
            agent
              .get('/api/offers' + testLocations.Europe.queryBoundingBox)
              .expect(200)
              .end(function (offersGetErr, offersGetRes) {
                // Handle offer get error
                if (offersGetErr) return done(offersGetErr);

                // Set assertions
                offersGetRes.body.features.should.have.lengthOf(2);

                // Only "host" offers here
                // Note that these are in random order from Mongo but it doesn't matter here
                offersGetRes.body.features[0].properties.type.should.equal(
                  'host',
                );
                offersGetRes.body.features[1].properties.type.should.equal(
                  'host',
                );

                // Call the assertion callback
                return done();
              });
          });
      })
      .catch(done);
  });
  describe('Search offers by "types" filter', function () {
    it('should be able to get list of offers from an area filtered by type "host"', function (done) {
      offerMeet
        .save()
        .then(() => {
          agent
            .post('/api/auth/signin')
            .send(credentials)
            .expect(200)
            .end(function (signinErr) {
              // Handle signin error
              if (signinErr) return done(signinErr);

              // Get offers (around Berlin)
              const filters = {
                types: ['host'],
              };
              agent
                .get(
                  '/api/offers' +
                    testLocations.Europe.queryBoundingBox +
                    '&filters=' +
                    encodeURIComponent(JSON.stringify(filters)),
                )
                .expect(200)
                .end(function (offersGetErr, offersGetRes) {
                  // Handle offer get error
                  if (offersGetErr) return done(offersGetErr);

                  // MongoDb returns these in random order, figure out order here
                  let user2Order = 1;
                  let user3Order = 0;
                  if (
                    offersGetRes.body.features[0].properties.id ===
                    offer2Id.toString()
                  ) {
                    user2Order = 0;
                    user3Order = 1;
                  }

                  // Set assertions
                  offersGetRes.body.features.should.have.lengthOf(2);
                  offersGetRes.body.features[
                    user2Order
                  ].properties.type.should.equal(offer2.type);
                  offersGetRes.body.features[
                    user3Order
                  ].properties.type.should.equal(offer3.type);

                  // Call the assertion callback
                  return done();
                });
            });
        })
        .catch(done);
    });
    it('should be able to get list of offers from an area filtered by type "meet"', function (done) {
      offerMeet
        .save()
        .then(() => {
          agent
            .post('/api/auth/signin')
            .send(credentials)
            .expect(200)
            .end(function (signinErr) {
              // Handle signin error
              if (signinErr) return done(signinErr);

              // Get offers (around Berlin)
              const filters = {
                types: ['meet'],
              };
              agent
                .get(
                  '/api/offers' +
                    testLocations.Europe.queryBoundingBox +
                    '&filters=' +
                    encodeURIComponent(JSON.stringify(filters)),
                )
                .expect(200)
                .end(function (offersGetErr, offersGetRes) {
                  // Handle offer get error
                  if (offersGetErr) return done(offersGetErr);

                  // Set assertions
                  offersGetRes.body.features.should.have.lengthOf(1);
                  offersGetRes.body.features[0].properties.type.should.equal(
                    offerMeet.type,
                  );

                  // Call the assertion callback
                  return done();
                });
            });
        })
        .catch(done);
    });
    it('should be able to get list of offers from an area filtered by non existing type', function (done) {
      offerMeet
        .save()
        .then(() => {
          agent
            .post('/api/auth/signin')
            .send(credentials)
            .expect(200)
            .end(function (signinErr) {
              // Handle signin error
              if (signinErr) return done(signinErr);

              // Get offers (around Berlin)
              const filters = {
                types: ['foobar'],
              };
              agent
                .get(
                  '/api/offers' +
                    testLocations.Europe.queryBoundingBox +
                    '&filters=' +
                    encodeURIComponent(JSON.stringify(filters)),
                )
                .expect(200)
                .end(function (offersGetErr, offersGetRes) {
                  // Handle offer get error
                  if (offersGetErr) return done(offersGetErr);

                  // Set assertions
                  offersGetRes.body.features.should.have.lengthOf(3);

                  // Count different offer types
                  // This produces `{'host': 2, 'meet': 1}`
                  const count = _.countBy(
                    offersGetRes.body.features,
                    offer => offer.properties.type,
                  );
                  count.host.should.equal(2);
                  count.meet.should.equal(1);

                  // Call the assertion callback
                  return done();
                });
            });
        })
        .catch(done);
    });
  });
  describe('Search offers by "languages" filter', function () {
    it('should be able to get list of offers from an area filtered by one language and ignore users by other language', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Get offers (around Berlin)
          const filters = {
            languages: ['fin'],
          };
          agent
            .get(
              '/api/offers' +
                testLocations.Europe.queryBoundingBox +
                '&filters=' +
                encodeURIComponent(JSON.stringify(filters)),
            )
            .expect(200)
            .end(function (offersGetErr, offersGetRes) {
              // Handle offer get error
              if (offersGetErr) return done(offersGetErr);

              // Set assertions
              offersGetRes.body.features.should.have.lengthOf(1);
              offersGetRes.body.features[0].properties.id.should.equal(
                offer2._id.toString(),
              );

              // Call the assertion callback
              return done();
            });
        });
    });
    it('should be able to get list of offers from an area filtered by multiple languages', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Get offers (around Berlin)
          const filters = {
            languages: ['fin', 'ita'],
          };
          agent
            .get(
              '/api/offers' +
                testLocations.Europe.queryBoundingBox +
                '&filters=' +
                encodeURIComponent(JSON.stringify(filters)),
            )
            .expect(200)
            .end(function (offersGetErr, offersGetRes) {
              // Handle offer get error
              if (offersGetErr) return done(offersGetErr);

              // MongoDb returns these in random order, figure out order here
              let user2Order = 1;
              let user3Order = 0;
              if (
                offersGetRes.body.features[0].properties.id ===
                offer2Id.toString()
              ) {
                user2Order = 0;
                user3Order = 1;
              }

              // Set assertions
              offersGetRes.body.features.should.have.lengthOf(2);
              offersGetRes.body.features[user2Order].properties.id.should.equal(
                offer2._id.toString(),
              );
              offersGetRes.body.features[user3Order].properties.id.should.equal(
                offer3._id.toString(),
              );

              // Call the assertion callback
              return done();
            });
        });
    });
  });
  describe('Search offers by "tribes" filter', function () {
    it('should be able to get list of offers from an area filtered by one tribe', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Get offers (around Berlin)
          const filters = {
            tribes: [tribe2Id],
          };
          agent
            .get(
              '/api/offers' +
                testLocations.Europe.queryBoundingBox +
                '&filters=' +
                encodeURIComponent(JSON.stringify(filters)),
            )
            .expect(200)
            .end(function (offersGetErr, offersGetRes) {
              // Handle offer get error
              if (offersGetErr) return done(offersGetErr);

              // Set assertions
              offersGetRes.body.features.should.have.lengthOf(1);
              const offerA = offersGetRes.body.features[0];
              offerA.properties.id.should.equal(offer2Id.toString());
              offerA.properties.status.should.equal(offer2.status);
              offerA.properties.type.should.equal(offer2.type);
              offerA.geometry.coordinates.should.have.lengthOf(2);
              offerA.geometry.coordinates[0].should.be.approximately(
                offer2.locationFuzzy[1],
                0.0000000000001,
              );
              offerA.geometry.coordinates[1].should.be.approximately(
                offer2.locationFuzzy[0],
                0.0000000000001,
              );

              // Call the assertion callback
              return done();
            });
        });
    });
    it('should be able to get list of offers from an area filtered by tribes and not get tribe-less offers', function (done) {
      user3.member = [];
      user3
        .save()
        .then(user3res => {
          user3res.member.length.should.equal(0);
          agent
            .post('/api/auth/signin')
            .send(credentials)
            .expect(200)
            .end(function (signinErr) {
              // Handle signin error
              if (signinErr) return done(signinErr);

              // Get offers (around Berlin)
              const filters = {
                tribes: [tribe1Id, tribe2Id],
              };
              agent
                .get(
                  '/api/offers' +
                    testLocations.Europe.queryBoundingBox +
                    '&filters=' +
                    encodeURIComponent(JSON.stringify(filters)),
                )
                .expect(200)
                .end(function (offersGetErr, offersGetRes) {
                  // Handle offer get error
                  if (offersGetErr) return done(offersGetErr);

                  // Set assertions
                  offersGetRes.body.features.should.have.lengthOf(1);
                  const offerA = offersGetRes.body.features[0];
                  offerA.properties.status.should.equal(offer2.status);
                  offerA.properties.type.should.equal(offer2.type);
                  offerA.geometry.coordinates.should.have.lengthOf(2);
                  offerA.geometry.coordinates[0].should.be.approximately(
                    offer2.locationFuzzy[1],
                    0.0000000000001,
                  );
                  offerA.geometry.coordinates[1].should.be.approximately(
                    offer2.locationFuzzy[0],
                    0.0000000000001,
                  );

                  // Call the assertion callback
                  return done();
                });
            });
        })
        .catch(done);
    });
    it('should be able to get list of offers from an area filtered by many tribes', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Get offers (around Berlin)
          const filters = {
            tribes: [tribe1Id, tribe2Id],
          };
          agent
            .get(
              '/api/offers' +
                testLocations.Europe.queryBoundingBox +
                '&filters=' +
                encodeURIComponent(JSON.stringify(filters)),
            )
            .expect(200)
            .end(function (offersGetErr, offersGetRes) {
              // Handle offer get error
              if (offersGetErr) return done(offersGetErr);

              // Set assertions
              offersGetRes.body.features.should.have.lengthOf(2);

              // MongoDb returns these in random order, figure out order here
              let user2Order = 1;
              let user3Order = 0;
              if (
                offersGetRes.body.features[0].properties.id ===
                offer2Id.toString()
              ) {
                user2Order = 0;
                user3Order = 1;
              }
              const offerA = offersGetRes.body.features[user2Order];
              const offerB = offersGetRes.body.features[user3Order];

              // User 2 offer
              offerA.properties.id.should.equal(offer2Id.toString());
              offerA.properties.status.should.equal(offer2.status);
              offerA.properties.type.should.equal(offer2.type);
              offerA.geometry.coordinates.should.have.lengthOf(2);
              offerA.geometry.coordinates[0].should.be.approximately(
                offer2.locationFuzzy[1],
                0.0000000000001,
              );
              offerA.geometry.coordinates[1].should.be.approximately(
                offer2.locationFuzzy[0],
                0.0000000000001,
              );

              // User 3 offer
              offerB.properties.id.should.equal(offer3Id.toString());
              offerB.properties.status.should.equal(offer3.status);
              offerB.properties.type.should.equal(offer2.type);
              offerB.geometry.coordinates.should.have.lengthOf(2);
              offerB.geometry.coordinates[0].should.be.approximately(
                offer3.locationFuzzy[1],
                0.0000000000001,
              );
              offerB.geometry.coordinates[1].should.be.approximately(
                offer3.locationFuzzy[0],
                0.0000000000001,
              );

              // Call the assertion callback
              return done();
            });
        });
    });
    it('should be able able to send empty filter request', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);
          agent
            .get(
              '/api/offers' +
                testLocations.Europe.queryBoundingBox +
                '&filters=&types=',
            )
            .expect(200)
            .end(function (offersGetErr, offersGetRes) {
              // Handle offer get error
              if (offersGetErr) return done(offersGetErr);

              // Set assertions
              offersGetRes.body.features.should.have.lengthOf(2);

              // Call the assertion callback
              return done();
            });
        });
    });
    it('should not be able to send non-json filter request', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);
          agent
            .get(
              '/api/offers' +
                testLocations.Europe.queryBoundingBox +
                '&filters={wrong}',
            )
            .expect(400)
            .end(function (offersGetErr, offersGetRes) {
              // Handle offer get error
              if (offersGetErr) return done(offersGetErr);

              // Set assertions
              offersGetRes.body.message.should.equal(
                'Could not parse filters.',
              );

              // Call the assertion callback
              return done();
            });
        });
    });
  });
  describe('Search offers by "seen" filter', function () {
    it('should be able to get list of offers from an area filtered by last seen', function (done) {
      user2.seen = moment()
        .subtract({
          months: 2,
        })
        .toDate();
      user2
        .save()
        .then(() => {
          agent
            .post('/api/auth/signin')
            .send(credentials)
            .expect(200)
            .end(function (signinErr) {
              // Handle signin error
              if (signinErr) {
                return done(signinErr);
              }
              const filters = {
                seen: {
                  months: 1,
                },
              };
              agent
                .get(
                  '/api/offers' +
                    testLocations.Europe.queryBoundingBox +
                    '&filters=' +
                    encodeURIComponent(JSON.stringify(filters)),
                )
                .expect(200)
                .end(function (offersGetErr, offersGetRes) {
                  // Handle offer get error
                  if (offersGetErr) return done(offersGetErr);

                  // Set assertions
                  // User2's offer should be filtered out
                  offersGetRes.body.features.should.be.have.lengthOf(1);
                  offersGetRes.body.features[0].properties.id.should.equal(
                    offer3Id.toString(),
                  );

                  // Call the assertion callback
                  return done();
                });
            });
        })
        .catch(done);
    });
  });
  /*
  describe('Exclude offers from shadowbanned, suspended and non-public users', () => {
    afterEach(async () => {
      await utils.signOut(agent);
    });
     ['shadowban', 'suspended'].forEach(role => {
      it(`should not see users with "${role}"`, async () => {
        user3.roles = [role];
        await user3.save();
        await utils.signIn(credentials, agent);
         const { body } = await agent
          .get('/api/offers' + testLocations.Europe.queryBoundingBox)
          .expect(200)
          .end();
         // body.features.should.have.lengthOf(1);
        console.log('🚀', role, body); //eslint-disable-line
      });
    });
     it(`should not see users which are not public`, async () => {
      user3.public = false;
      await user3.save();
      await utils.signIn(credentials, agent);
       const { body } = await agent
        .get('/api/offers' + testLocations.Europe.queryBoundingBox)
        .expect(200)
        .end();
       // body.features.should.have.lengthOf(1);
      console.log('🚀 non public', body); //eslint-disable-line
    });
  });
  */
  it('should be able to get offers from users with circles in common and have "showOnlyInMyCircles" set', async function () {
    // Verify that offers where showOnlyInMyCircles is true are only appearing
    // in searches where the authenticated user (user1) has at least one circle
    // in common with the user that owns the offer.
    //
    // Makes the users members of the following tribes:
    //   - user1: tribe1, tribe2  (the authenticated user)
    //   - user2: tribe2, tribe3  (overlaps with user1)
    //   - user3: tribe3          (does not overlap with user1)
    // The following hosting offers are available:
    //   - offer1 is owned by user2 and should appear as user1's circles overlap
    //     with the ones of user2 while showOnlyInMyCircles is true.
    //   - offer2 is owned by user3 and should *not* appear as user1's circles
    //     do not overlap with the ones of user3 while showOnlyInMyCircles is true.
    //   - offer3 is owned by user3 and should appear despite user1's circles not
    //     overlapping with the ones of user3 since showOnlyInMyCircles is false.
    const tribe3 = await new Tribe({
      slug: 'tribe3',
      label: 'tribe3',
      color: '333333',
      count: 1,
      public: true,
    }).save();
    const tribe3Id = tribe3._id;

    // Set the users' memberships.
    user1.member = [
      {
        tribe: tribe1Id,
        since: new Date(),
      },
      {
        tribe: tribe2Id,
        since: new Date(),
      },
    ];
    await user1.save();
    user2.member = [
      {
        tribe: tribe2Id,
        since: new Date(),
      },
      {
        tribe: tribe3Id,
        since: new Date(),
      },
    ];
    await user2.save();
    user3.member = {
      tribe: tribe3Id,
      since: new Date(),
    };
    await user3.save();

    // Update the hosting offers.
    // Save hosting offer 1 (user2, showOnlyInMyCircles=true).
    const o1 = new Offer({
      ...offer1,
      user: user2Id,
      location: testLocations.Europe.location,
      showOnlyInMyCircles: true,
    });
    const offer1Id = (await o1.save())._id;

    // Save hosting offer 2 (user3, showOnlyInMyCircles=true).
    offer2.user = user3Id;
    offer2.location = testLocations.Europe.location;
    offer2.showOnlyInMyCircles = true;
    await offer2.save();

    // Save hosting offer 3 (user3, showOnlyInMyCircles=false).
    offer3.user = user3Id;
    offer3.location = testLocations.Europe.location;
    offer3.showOnlyInMyCircles = false;
    await offer3.save();

    // The actual test.
    // Sign in.
    await agent.post('/api/auth/signin').send(credentials).expect(200);

    // Fetch the offers.
    const offersGetRes = await agent
      .get('/api/offers' + testLocations.Europe.queryBoundingBox)
      .expect(200);

    // Verify the offers.

    // Offer 1 and 3 should match. See the test description above for why.
    const features = offersGetRes.body.features;
    features.should.have.lengthOf(2);

    // The offers are returned in any order.
    let offerRes1;
    let offerRes3;
    if (features[0].properties.id === offer1Id.toString()) {
      offerRes1 = features[0];
      offerRes3 = features[1];
    } else {
      offerRes1 = features[1];
      offerRes3 = features[0];
    }
    offerRes1.properties.id.should.equal(offer1Id.toString());
    offerRes3.properties.id.should.equal(offer3Id.toString());
  });
});
