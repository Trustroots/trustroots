const should = require('should');
const request = require('supertest');
const path = require('path');
const async = require('async');
const moment = require('moment');
const mongoose = require('mongoose');
const express = require(path.resolve('./config/lib/express'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

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
let user1Id;
let user2Id;
let user3Id;
let offer1;
let offer2;
let offer2Id;
let offer3;
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
describe('Offer CRUD tests', function () {
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
    });

    // Used only for sending via POST and thus doesn't include some data
    offer1 = {
      type: 'host',
      status: 'yes',
      description: '<p>1 I can host! :)</p>',
      noOfferDescription: '<p>1 I cannot host... :(</p>',
      maxGuests: 5,
      location: testLocations.Europe.location,
      showOnlyInMyCircles: false,
    };

    offer2 = new Offer({
      type: 'host',
      status: 'yes',
      description: '<p>2 I can host! :)</p>',
      noOfferDescription: '<p>2 I cannot host... :(</p>',
      maxGuests: 3,
      updated: new Date(),
      location: [52.498981209298776, 13.418329954147339],
    });

    offer3 = new Offer({
      type: 'host',
      status: 'yes',
      description: '<p>3 I can host! :)</p>',
      noOfferDescription: '<p>3 I cannot host... :(</p>',
      maxGuests: 1,
      updated: new Date(),
      location: [52.498981209298775, 13.418329954147338],
    });

    offerMeet = new Offer({
      type: 'meet',
      description: '<p>Dinner party!</p>',
      validUntil: moment().add(30, 'day').toDate(),
      updated: new Date(),
      location: [52.498981209298887, 13.418329954147449],
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
    async.waterfall(
      [
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
          user1.save(function (err, user1res) {
            user1Id = user1res._id;
            done(err);
          });
        },
        // Save user 2 (with tribe membership)
        function (done) {
          user2.member = [
            {
              tribe: tribe2Id,
              since: new Date(),
            },
          ];
          user2.save(function (err, user2res) {
            user2Id = user2res._id;
            done(err);
          });
        },
        // Save user 3 (with tribe membership)
        function (done) {
          user3.member = [
            {
              tribe: tribe1Id,
              since: new Date(),
            },
          ];
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
          offer3.save(function (err) {
            done(err);
          });
        },
      ],
      function (err) {
        should.not.exist(err);
        doneBeforeEach(err);
      },
    );
  });

  afterEach(utils.clearDatabase);

  describe('Read offer by offer id:', function () {
    it('should not be able to read offer by offer id if not authenticated', function (done) {
      agent
        .get('/api/offers/' + offer2Id)
        .expect(403)
        .end(function (offerSaveErr, offerSaveRes) {
          offerSaveRes.body.message.should.equal('Forbidden.');

          // Call the assertion callback
          return done(offerSaveErr);
        });
    });

    it('should be able to read offers of other users by offer id when authenticated', function (done) {
      agent
        .post('/api/auth/signin')
        // authenticated as `user1`
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Get a offer from the other user by offer id
          agent
            .get('/api/offers/' + offer2Id)
            .expect(200)
            .end(function (offerGetErr, offerGetRes) {
              // Handle offer get error
              if (offerGetErr) return done(offerGetErr);

              // Set assertions
              offerGetRes.body.user._id.should.equal(user2Id.toString());
              offerGetRes.body.status.should.equal(offer2.status);
              offerGetRes.body.description.should.equal(offer2.description);
              offerGetRes.body.noOfferDescription.should.equal(
                offer2.noOfferDescription,
              );
              offerGetRes.body.maxGuests.should.equal(offer2.maxGuests);
              offerGetRes.body.location.should.be
                .instanceof(Array)
                .and.have.lengthOf(2);
              offerGetRes.body.location[0].should.be.approximately(
                offer2.locationFuzzy[0],
                0.0000000000001,
              );
              offerGetRes.body.location[1].should.be.approximately(
                offer2.locationFuzzy[1],
                0.0000000000001,
              );
              offerGetRes.body.updated.should.not.be.empty();
              should.not.exist(offerGetRes.body.locationFuzzy);

              // Call the assertion callback
              return done();
            });
        });
    });

    it('should be able to read offers by id and get populated tribes array', function (done) {
      agent
        .post('/api/auth/signin')
        // authenticated as `user1`
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Get a offer from the other user by offer id
          agent
            .get('/api/offers/' + offer2Id)
            .expect(200)
            .end(function (offerGetErr, offerGetRes) {
              // Handle offer get error
              if (offerGetErr) return done(offerGetErr);

              // Set assertions
              offerGetRes.body.user.member.length.should.equal(1);
              offerGetRes.body.user.member[0].since.should.not.be.empty();
              offerGetRes.body.user.member[0].tribe._id.should.equal(
                tribe2Id.toString(),
              );
              offerGetRes.body.user.member[0].tribe.color.should.equal(
                tribe2.color,
              );
              offerGetRes.body.user.member[0].tribe.count.should.equal(
                tribe2.count,
              );
              offerGetRes.body.user.member[0].tribe.slug.should.equal(
                tribe2.slug,
              );
              offerGetRes.body.user.member[0].tribe.label.should.equal(
                tribe2.label,
              );

              // Call the assertion callback
              return done();
            });
        });
    });
  });

  describe('Read offer by user id:', function () {
    it('should not be able to read offer by user id if not authenticated', function (done) {
      agent
        .get('/api/offers-by/' + user2Id)
        .expect(403)
        .end(function (offerSaveErr, offerSaveRes) {
          offerSaveRes.body.message.should.equal('Forbidden.');

          // Call the assertion callback
          return done(offerSaveErr);
        });
    });

    it('should be able to read offers of other users by user id when authenticated', function (done) {
      agent
        .post('/api/auth/signin')
        // authenticated as `user1`
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Get a offer from the other user
          agent
            .get('/api/offers-by/' + user2Id)
            .expect(200)
            .end(function (offerGetErr, offerGetRes) {
              // Handle offer get error
              if (offerGetErr) return done(offerGetErr);

              // Set assertions
              offerGetRes.body.should.be.instanceof(Array).and.have.lengthOf(1);
              offerGetRes.body[0]._id.should.equal(offer2._id.toString());
              offerGetRes.body[0].status.should.equal(offer2.status);
              offerGetRes.body[0].type.should.equal(offer2.type);
              offerGetRes.body[0].description.should.equal(offer2.description);
              offerGetRes.body[0].noOfferDescription.should.equal(
                offer2.noOfferDescription,
              );
              offerGetRes.body[0].maxGuests.should.equal(offer2.maxGuests);
              offerGetRes.body[0].location.should.be
                .instanceof(Array)
                .and.have.lengthOf(2);
              offerGetRes.body[0].location[0].should.be.approximately(
                offer2.locationFuzzy[0],
                0.0000000000001,
              );
              offerGetRes.body[0].location[1].should.be.approximately(
                offer2.locationFuzzy[1],
                0.0000000000001,
              );
              offerGetRes.body[0].user.should.equal(offer2.user.toString());
              offerGetRes.body[0].updated.should.not.be.empty();
              should.not.exist(offerGetRes.body[0].locationFuzzy);
              should.not.exist(offerGetRes.body[0].created);

              // Call the assertion callback
              return done();
            });
        });
    });
  });

  describe('Deleting offer', function () {
    it('should not be able to delete offer if not authenticated', function (done) {
      agent
        .delete('/api/offers')
        .expect(403)
        .end(function (offerSaveErr, offerSaveRes) {
          offerSaveRes.body.message.should.equal('Forbidden.');

          // Call the assertion callback
          return done(offerSaveErr);
        });
    });

    it('should not be able to delete offer of other user', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Save a new offer
          agent
            .delete('/api/offers/' + offer2Id)
            .send(offer2)
            .expect(403)
            .end(function (offerSaveErr) {
              // Handle offer save error
              if (offerSaveErr) return done(offerSaveErr);

              Offer.findOne(
                {
                  _id: offer2Id,
                },
                function (err, offer) {
                  should.not.exist(err);
                  should.exist(offer);
                  return done();
                },
              );
            });
        });
    });

    it('should be able to delete offer if authenticated', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials2)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Save a new offer
          agent
            .delete('/api/offers/' + offer2Id)
            .send(offer2)
            .expect(200)
            .end(function (offerSaveErr) {
              // Handle offer save error
              if (offerSaveErr) return done(offerSaveErr);

              Offer.findOne(
                {
                  _id: offer2Id,
                },
                function (err, offer) {
                  should.not.exist(err);
                  should.not.exist(offer);
                  return done();
                },
              );
            });
        });
    });
  });

  describe('Creating offer', function () {
    it('should not be able to save offer if not authenticated', function (done) {
      agent
        .post('/api/offers')
        .send(offer1)
        .expect(403)
        .end(function (offerSaveErr, offerSaveRes) {
          offerSaveRes.body.message.should.equal('Forbidden.');

          // Call the assertion callback
          return done(offerSaveErr);
        });
    });

    it('should be able to create offer if authenticated', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Save a new offer
          agent
            .post('/api/offers')
            .send(offer1)
            .expect(200)
            .end(function (offerSaveErr, offerSaveRes) {
              // Handle offer save error
              if (offerSaveErr) return done(offerSaveErr);

              // Set assertions
              offerSaveRes.body.message.should.equal('Offer saved.');

              return done();
            });
        });
    });

    it('should be able to create offer if authenticated', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Save a new offer
          agent
            .post('/api/offers')
            .send(offer1)
            .expect(200)
            .end(function (offerSaveErr) {
              // Handle offer save error
              if (offerSaveErr) return done(offerSaveErr);

              // Get a offer
              agent
                .get('/api/offers-by/' + user1Id)
                .expect(200)
                .end(function (offerGetErr, offerGetRes) {
                  // Handle offer get error
                  if (offerGetErr) return done(offerGetErr);

                  // Set assertions
                  offerGetRes.body.should.be
                    .instanceof(Array)
                    .and.have.lengthOf(1);
                  offerGetRes.body[0]._id.should.not.be.empty();
                  offerGetRes.body[0].status.should.equal(offer1.status);
                  offerGetRes.body[0].description.should.equal(
                    offer1.description,
                  );
                  offerGetRes.body[0].noOfferDescription.should.equal(
                    offer1.noOfferDescription,
                  );
                  offerGetRes.body[0].maxGuests.should.equal(offer1.maxGuests);
                  offerGetRes.body[0].location.should.be
                    .instanceof(Array)
                    .and.have.lengthOf(2);
                  offerGetRes.body[0].location[0].should.be.approximately(
                    offer1.location[0],
                    0.0000000000001,
                  );
                  offerGetRes.body[0].location[1].should.be.approximately(
                    offer1.location[1],
                    0.0000000000001,
                  );
                  offerGetRes.body[0].user.should.equal(user1Id.toString());
                  offerGetRes.body[0].updated.should.not.be.empty();
                  should.not.exist(offerGetRes.body[0].locationFuzzy);

                  // Call the assertion callback
                  return done();
                });
            });
        });
    });

    it('should be able to create offer without status and status should default to "yes"', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          const offerWithoutStatus = offer1;
          delete offerWithoutStatus.status;

          // Save a new offer
          agent
            .post('/api/offers')
            .send(offerWithoutStatus)
            .expect(200)
            .end(function (offerSaveErr) {
              if (offerSaveErr) return done(offerSaveErr);

              // Get the offer
              agent
                .get('/api/offers-by/' + user1Id)
                .expect(200)
                .end(function (offerGetErr, offerGetRes) {
                  // Handle offer get error
                  if (offerGetErr) return done(offerGetErr);

                  // Set assertions
                  offerGetRes.body[0].status.should.equal('yes');

                  // Call the assertion callback
                  return done();
                });
            });
        });
    });

    it('should not be able to create offer without type', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          const offerWithoutType = offer1;
          delete offerWithoutType.type;

          // Save a new offer
          agent
            .post('/api/offers')
            .send(offerWithoutType)
            .expect(400)
            .end(function (offerSaveErr, offerSaveRes) {
              if (offerSaveErr) return done(offerSaveErr);

              offerSaveRes.body.message.should.equal(
                'Missing or invalid offer type.',
              );

              return done();
            });
        });
    });

    it('should not be able to create offer without location', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          const offerWithoutLocation = offer1;
          delete offerWithoutLocation.location;

          // Save a new offer
          agent
            .post('/api/offers')
            .send(offerWithoutLocation)
            .expect(400)
            .end(function (offerSaveErr, offerSaveRes) {
              offerSaveRes.body.message.should.equal('Missing offer location.');

              // Call the assertion callback
              return done(offerSaveErr);
            });
        });
    });

    it('should be able to set `validUntil`', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          offerMeet.validUntil = moment().add(5, 'days').toDate();

          // Post offer
          agent
            .post('/api/offers')
            .send(offerMeet)
            .expect(200)
            .end(function (offerPostErr) {
              // Handle offer post error
              if (offerPostErr) return done(offerPostErr);

              agent
                .get('/api/offers-by/' + user1Id)
                .expect(200)
                .end(function (offersByErr, offers) {
                  if (offersByErr) return done(offersByErr);

                  moment(offers.body[0].validUntil)
                    .diff(moment(), 'days')
                    .should.equal(4);

                  return done();
                });
            });
        });
    });

    it('should default to 30 days from now when trying to set `validUntil` to past', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          offerMeet.validUntil = moment().subtract(5, 'days').toDate();

          // Post offer
          agent
            .post('/api/offers')
            .send(offerMeet)
            .expect(200)
            .end(function (offerPostErr) {
              // Handle offer post error
              if (offerPostErr) return done(offerPostErr);

              agent
                .get('/api/offers-by/' + user1Id)
                .expect(200)
                .end(function (offersByErr, offers) {
                  if (offersByErr) return done(offersByErr);

                  moment(offers.body[0].validUntil)
                    .diff(moment(), 'days')
                    .should.equal(29);

                  return done();
                });
            });
        });
    });

    it('should default to 30 days from now when trying to set `validUntil` to over 30 days from now', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          offerMeet.validUntil = moment().add(32, 'days').toDate();

          // Post offer
          agent
            .post('/api/offers')
            .send(offerMeet)
            .expect(200)
            .end(function (offerPostErr) {
              // Handle offer post error
              if (offerPostErr) return done(offerPostErr);

              agent
                .get('/api/offers-by/' + user1Id)
                .expect(200)
                .end(function (offersByErr, offers) {
                  if (offersByErr) return done(offersByErr);

                  moment(offers.body[0].validUntil)
                    .diff(moment(), 'days')
                    .should.equal(29);

                  return done();
                });
            });
        });
    });

    it('should default to 30 days from now when not explicitly setting `validUntil`', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          delete offerMeet.validUntil;

          // Post offer
          agent
            .post('/api/offers')
            .send(offerMeet)
            .expect(200)
            .end(function (offerPostErr) {
              // Handle offer post error
              if (offerPostErr) return done(offerPostErr);

              agent
                .get('/api/offers-by/' + user1Id)
                .expect(200)
                .end(function (offersByErr, offers) {
                  if (offersByErr) return done(offersByErr);

                  moment(offers.body[0].validUntil)
                    .diff(moment(), 'days')
                    .should.equal(29);

                  return done();
                });
            });
        });
    });
  });

  describe('Updating offer', function () {
    it('should not be able to update offer if not authenticated', function (done) {
      agent
        .put('/api/offers/' + offer2Id)
        .send(offer2)
        .expect(403)
        .end(function (offerSaveErr, offerSaveRes) {
          offerSaveRes.body.message.should.equal('Forbidden.');

          // Call the assertion callback
          return done(offerSaveErr);
        });
    });

    it('should be able to update existing offer', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Save a new offer
          agent
            .post('/api/offers')
            .send(offer1)
            .expect(200)
            .end(function (offerSaveErr) {
              // Handle offer save error
              if (offerSaveErr) return done(offerSaveErr);

              // Get id for offer we just saved
              Offer.findOne(
                {
                  user: user1Id,
                },
                function (offerFindErr, offer) {
                  // Handle error
                  if (offerFindErr) return done(offerFindErr);

                  // Modify offer
                  offer.description = 'MODIFIED';
                  offer.noOfferDescription = 'MODIFIED';
                  offer.showOnlyInMyCircles = true;

                  // Store this for later comparison
                  const previousUpdated = offer.updated;

                  // Update offer
                  agent
                    .put('/api/offers/' + offer._id)
                    .send(offer)
                    .expect(200)
                    .end(function (offerPutErr, offerPutRes) {
                      // Handle offer put error
                      if (offerPutErr) return done(offerPutErr);

                      offerPutRes.body.message.should.equal('Offer updated.');

                      Offer.findOne(
                        {
                          _id: offer._id,
                        },
                        function (err, offerNew) {
                          offerNew.description.should.equal('MODIFIED');
                          offerNew.noOfferDescription.should.equal('MODIFIED');
                          offerNew.updated.should.not.equal(previousUpdated);
                          offerNew.showOnlyInMyCircles.should.equal(true);
                          return done(err);
                        },
                      );
                    });
                },
              );
            });
        });
    });

    it('should not be able to update offer of other user', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          offer2.description = '<p>Not allowed</p>';

          // Update offer
          agent
            .put('/api/offers/' + offer2Id)
            .send(offer2)
            .expect(403)
            .end(function (offerSaveErr) {
              // Handle offer save error
              if (offerSaveErr) return done(offerSaveErr);

              Offer.findOne(
                {
                  _id: offer2Id,
                },
                function (err, offer) {
                  should.not.exist(err);
                  offer.description.should.not.equal(offer2.description);
                  return done();
                },
              );
            });
        });
    });

    it('should not able to change offer type when updating offer', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Save a new offer
          agent
            .post('/api/offers')
            .send(offer1)
            .expect(200)
            .end(function (offerSaveErr) {
              // Handle offer save error
              if (offerSaveErr) return done(offerSaveErr);

              // Get id for offer we just saved
              Offer.findOne(
                {
                  user: user1Id,
                },
                function (offerFindErr, offer) {
                  // Handle error
                  if (offerFindErr) return done(offerFindErr);

                  // Modify offer
                  const modifiedOffer = offer1;
                  modifiedOffer.type = 'meet';

                  // Update offer
                  agent
                    .put('/api/offers/' + offer._id)
                    .send(modifiedOffer)
                    .expect(400)
                    .end(function (offerSaveErr, offerSaveRes) {
                      // Handle offer save error
                      if (offerSaveErr) return done(offerSaveErr);

                      offerSaveRes.body.message.should.equal(
                        'You cannot update offer type.',
                      );

                      Offer.find(
                        {
                          user: user1Id,
                        },
                        function (err, offers) {
                          offers.length.should.equal(1);
                          offers[0].type.should.equal('host');
                          return done(err);
                        },
                      );
                    });
                },
              );
            });
        });
    });

    it('should be able to update `validUntil` value to 31 days from now', function (done) {
      const now = moment();
      const fromNow1 = moment().add(2, 'days');
      const fromNow2 = moment().add(31, 'days');

      offerMeet.user = user1Id;
      offerMeet.validUntil = fromNow1.toDate();

      offerMeet.save(function (offerMeetErr, offerMeetSaved) {
        // Handle save error
        if (offerMeetErr) return done(offerMeetErr);

        moment(offerMeetSaved.validUntil).diff(now, 'days').should.equal(2);

        agent
          .post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            // Handle signin error
            if (signinErr) return done(signinErr);

            offerMeet.validUntil = fromNow2.toDate();

            // Update offer
            agent
              .put('/api/offers/' + offerMeetSaved._id)
              .send(offerMeet)
              .expect(200)
              .end(function (offerPutErr) {
                // Handle offer put error
                if (offerPutErr) return done(offerPutErr);

                Offer.findOne(
                  {
                    _id: offerMeetSaved._id,
                  },
                  function (err, offerNew) {
                    moment(offerNew.validUntil)
                      .diff(now, 'days')
                      .should.equal(30);

                    return done(err);
                  },
                );
              });
          });
      });
    });

    it('should be keep `validUntil` value to previously saved when updating offer', function (done) {
      const now = moment();

      offerMeet.user = user1Id;
      offerMeet.validUntil = moment().add(2, 'days');

      offerMeet.save(function (offerMeetErr, offerMeetSaved) {
        // Handle save error
        if (offerMeetErr) return done(offerMeetErr);

        moment(offerMeetSaved.validUntil).diff(now, 'days').should.equal(2);

        agent
          .post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            // Handle signin error
            if (signinErr) return done(signinErr);

            // Update offer
            agent
              .put('/api/offers/' + offerMeetSaved._id)
              .send(offerMeet)
              .expect(200)
              .end(function (offerPutErr) {
                // Handle offer put error
                if (offerPutErr) return done(offerPutErr);

                Offer.findOne(
                  {
                    _id: offerMeetSaved._id,
                  },
                  function (err, offerNew) {
                    moment(offerNew.validUntil)
                      .diff(now, 'days')
                      .should.equal(2);

                    return done(err);
                  },
                );
              });
          });
      });
    });

    it('should default to 30 days from now when attempting to set `validUntil` value to over 30 days from now', function (done) {
      const now = moment();
      const fromNow1 = moment().add(2, 'days');
      const fromNow2 = moment().add(32, 'days');

      offerMeet.user = user1Id;
      offerMeet.validUntil = fromNow1.toDate();

      offerMeet.save(function (offerMeetErr, offerMeetSaved) {
        // Handle save error
        if (offerMeetErr) return done(offerMeetErr);

        moment(offerMeetSaved.validUntil).diff(now, 'days').should.equal(2);

        agent
          .post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            // Handle signin error
            if (signinErr) return done(signinErr);

            offerMeet.validUntil = fromNow2.toDate();

            // Update offer
            agent
              .put('/api/offers/' + offerMeetSaved._id)
              .send(offerMeet)
              .expect(200)
              .end(function (offerPutErr) {
                // Handle offer put error
                if (offerPutErr) return done(offerPutErr);

                Offer.findOne(
                  {
                    _id: offerMeetSaved._id,
                  },
                  function (err, offerNew) {
                    // We set it to 32, but it should default to 30 days
                    moment(offerNew.validUntil)
                      .diff(now, 'days')
                      .should.equal(30);

                    return done(err);
                  },
                );
              });
          });
      });
    });

    it('should default to 30 days from now when attempting to set `validUntil` value to past', function (done) {
      const now = moment();
      const fromNow1 = moment().add(2, 'days');
      const fromNow2 = moment().subtract(1, 'days');

      offerMeet.user = user1Id;
      offerMeet.validUntil = fromNow1.toDate();

      offerMeet.save(function (offerMeetErr, offerMeetSaved) {
        // Handle save error
        if (offerMeetErr) return done(offerMeetErr);

        moment(offerMeetSaved.validUntil).diff(now, 'days').should.equal(2);

        agent
          .post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function (signinErr) {
            // Handle signin error
            if (signinErr) return done(signinErr);

            offerMeet.validUntil = fromNow2.toDate();

            // Update offer
            agent
              .put('/api/offers/' + offerMeetSaved._id)
              .send(offerMeet)
              .expect(200)
              .end(function (offerPutErr) {
                // Handle offer put error
                if (offerPutErr) return done(offerPutErr);

                Offer.findOne(
                  {
                    _id: offerMeetSaved._id,
                  },
                  function (err, offerNew) {
                    // We set it to -2 days, but it should default to 30 days
                    moment(offerNew.validUntil)
                      .diff(now, 'days')
                      .should.equal(30);

                    return done(err);
                  },
                );
              });
          });
      });
    });

    it('should remove reactivation flag field when updating offer', function (done) {
      agent
        .post('/api/auth/signin')
        .send(credentials2)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Add field to offer
          offer2.reactivateReminderSent = new Date();
          offer2.save(function (offerSaveErr, offerSavedRes) {
            // Handle offer save error
            if (offerSaveErr) return done(offerSaveErr);

            // Save a new offer
            agent
              .put('/api/offers/' + offerSavedRes._id)
              .send(offer2)
              .expect(200)
              .end(function (offerSaveErr) {
                // Handle offer save error
                if (offerSaveErr) return done(offerSaveErr);

                Offer.findOne(
                  {
                    user: user2Id,
                  },
                  function (err, offer) {
                    should.not.exist(offer.reactivateReminderSent);
                    return done(err);
                  },
                );
              });
          });
        });
    });
  });
});
