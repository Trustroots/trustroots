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
    Tag = mongoose.model('Tag'),
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
    user1Id,
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

var queryBoundingBox =
  '?northEastLat=55.31212135084999' +
  '&northEastLng=18.73318142361111' +
  '&southWestLat=44.66407507240992' +
  '&southWestLng=3.689914279513889';

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

  beforeEach(function(doneBeforeEach) {
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
      public: true
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
      provider: 'local',
      public: true
    });

    // Create a new user
    user3 = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test3@test.com',
      username: credentials.username + '3',
      password: credentials.password,
      provider: 'local',
      public: true
    });

    // Used only for sending via POST and thus doesn't include some data
    offer1 = {
      type: 'host',
      status: 'yes',
      description: '<p>1 I can host! :)</p>',
      noOfferDescription: '<p>1 I cannot host... :(</p>',
      maxGuests: 5,
      location: [52.48556355813466, 13.489011526107788]
    };

    offer2 = new Offer({
      type: 'host',
      status: 'yes',
      description: '<p>2 I can host! :)</p>',
      noOfferDescription: '<p>2 I cannot host... :(</p>',
      maxGuests: 3,
      updated: new Date(),
      location: [52.498981209298776, 13.418329954147339],
      locationFuzzy: [52.50155039101136, 13.42255019882177]
    });

    offer3 = new Offer({
      type: 'host',
      status: 'yes',
      description: '<p>3 I can host! :)</p>',
      noOfferDescription: '<p>3 I cannot host... :(</p>',
      maxGuests: 1,
      updated: new Date(),
      location: [52.498981209298775, 13.418329954147338],
      locationFuzzy: [52.50155039101134, 13.42255019882175]
    });

    offerMeet = new Offer({
      type: 'meet',
      description: '<p>Dinner party!</p>',
      validUntil: moment().add(30, 'day').toDate(),
      updated: new Date(),
      location: [52.498981209298887, 13.418329954147449],
      locationFuzzy: [52.50155039101246, 13.42255019882288]
    });

    tribe1 = new Tag({
      'slug': 'tribe1',
      'label': 'tribe1',
      'color': '111111',
      'tribe': true,
      'count': 1,
      'public': true
    });

    tribe2 = new Tag({
      'slug': 'tribe2',
      'label': 'tribe2',
      'color': '222222',
      'tribe': true,
      'count': 1,
      'public': true
    });

    // Save data to the test db
    async.waterfall([
      // Save tribe 1
      function(done) {
        tribe1.save(function(err, tribe1) {
          tribe1Id = tribe1._id;
          done(err);
        });
      },
      // Save tribe 2
      function(done) {
        tribe2.save(function(err, tribe2) {
          tribe2Id = tribe2._id;
          done(err);
        });
      },
      // Save user 1 (without tribe membership)
      function(done) {
        user1.save(function(err, user1res) {
          user1Id = user1res._id;
          done(err);
        });
      },
      // Save user 2 (with tribe membership)
      function(done) {
        user2.member = [{
          tag: tribe2Id,
          since: new Date(),
          relation: 'is'
        }];
        user2.save(function(err, user2res) {
          user2Id = user2res._id;
          done(err);
        });
      },
      // Save user 3 (with tribe membership)
      function(done) {
        user3.member = [{
          tag: tribe1Id,
          since: new Date(),
          relation: 'is'
        }];
        user3.save(function(err, user3res) {
          user3Id = user3res._id;
          return done(err);
        });
      },
      // Save hosting offer 2
      function(done) {
        offer2.user = user2Id;
        offer2.save(function(err, offer2) {
          offer2Id = offer2._id;
          done(err);
        });
      },
      // Save hosting offer 3
      function(done) {
        offer3.user = user3Id;
        offer3.save(function(err, offer3) {
          offer3Id = offer3._id;
          done(err);
        });
      }
    ], function(err) {
      should.not.exist(err);
      doneBeforeEach(err);
    });
  });


  describe('Read offer by offer id:', function() {

    it('should not be able to read offer by offer id if not authenticated', function(done) {

      agent.get('/api/offers/' + offer2Id)
        .expect(403)
        .end(function(offerSaveErr, offerSaveRes) {

          offerSaveRes.body.message.should.equal('Forbidden.');

          // Call the assertion callback
          return done(offerSaveErr);
        });
    });

    it('should be able to read offers of other users by offer id when authenticated', function(done) {
      agent.post('/api/auth/signin')
        // authenticated as `user1`
        .send(credentials)
        .expect(200)
        .end(function(signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Get a offer from the other user by offer id
          agent.get('/api/offers/' + offer2Id)
            .expect(200)
            .end(function(offerGetErr, offerGetRes) {
              // Handle offer get error
              if (offerGetErr) return done(offerGetErr);

              // Set assertions
              offerGetRes.body.user._id.should.equal(user2Id.toString());
              offerGetRes.body.status.should.equal(offer2.status);
              offerGetRes.body.description.should.equal(offer2.description);
              offerGetRes.body.noOfferDescription.should.equal(offer2.noOfferDescription);
              offerGetRes.body.maxGuests.should.equal(offer2.maxGuests);
              offerGetRes.body.location.should.be.instanceof(Array).and.have.lengthOf(2);
              offerGetRes.body.location[0].should.be.approximately(offer2.locationFuzzy[0], 0.0000000000001);
              offerGetRes.body.location[1].should.be.approximately(offer2.locationFuzzy[1], 0.0000000000001);
              should.not.exist(offerGetRes.body.updated);
              should.not.exist(offerGetRes.body.locationFuzzy);

              // Call the assertion callback
              return done();
            });

        });
    });

    it('should be able to read offers by id and get populated memberships array', function(done) {
      agent.post('/api/auth/signin')
        // authenticated as `user1`
        .send(credentials)
        .expect(200)
        .end(function(signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Get a offer from the other user by offer id
          agent.get('/api/offers/' + offer2Id)
            .expect(200)
            .end(function(offerGetErr, offerGetRes) {
              // Handle offer get error
              if (offerGetErr) return done(offerGetErr);

              // Set assertions
              offerGetRes.body.user.member.length.should.equal(1);
              offerGetRes.body.user.member[0].relation.should.equal('is');
              offerGetRes.body.user.member[0].since.should.not.be.empty();
              offerGetRes.body.user.member[0].tag._id.should.equal(tribe2Id.toString());
              offerGetRes.body.user.member[0].tag.tribe.should.equal(tribe2.tribe);
              offerGetRes.body.user.member[0].tag.color.should.equal(tribe2.color);
              offerGetRes.body.user.member[0].tag.count.should.equal(tribe2.count);
              offerGetRes.body.user.member[0].tag.slug.should.equal(tribe2.slug);
              offerGetRes.body.user.member[0].tag.label.should.equal(tribe2.label);

              // Call the assertion callback
              return done();
            });

        });
    });

    it('should be able to read offers of other users by offer id when authenticated', function(done) {
      agent.post('/api/auth/signin')
        // authenticated as `user1`
        .send(credentials)
        .expect(200)
        .end(function(signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Get a offer from the other user
          agent.get('/api/offers/' + offer2Id)
            .expect(200)
            .end(function(offerGetErr, offerGetRes) {
              // Handle offer get error
              if (offerGetErr) return done(offerGetErr);

              // Set assertions
              offerGetRes.body._id.should.equal(offer2._id.toString());
              offerGetRes.body.status.should.equal(offer2.status);
              offerGetRes.body.description.should.equal(offer2.description);
              offerGetRes.body.noOfferDescription.should.equal(offer2.noOfferDescription);
              offerGetRes.body.maxGuests.should.equal(offer2.maxGuests);
              offerGetRes.body.location.should.be.instanceof(Array).and.have.lengthOf(2);
              offerGetRes.body.location[0].should.be.approximately(offer2.locationFuzzy[0], 0.0000000000001);
              offerGetRes.body.location[1].should.be.approximately(offer2.locationFuzzy[1], 0.0000000000001);
              offerGetRes.body.user.should.not.be.empty();
              should.not.exist(offerGetRes.body.locationFuzzy);
              should.not.exist(offerGetRes.body.updated);
              should.not.exist(offerGetRes.body.created);

              // Call the assertion callback
              return done();
            });

        });
    });

  });

  describe('Read offer by user id:', function() {

    it('should not be able to read offer by user id if not authenticated', function(done) {

      agent.get('/api/offers-by/' + user2Id)
        .expect(403)
        .end(function(offerSaveErr, offerSaveRes) {

          offerSaveRes.body.message.should.equal('Forbidden.');

          // Call the assertion callback
          return done(offerSaveErr);
        });
    });

    it('should be able to read offers of other users by user id when authenticated', function(done) {
      agent.post('/api/auth/signin')
        // authenticated as `user1`
        .send(credentials)
        .expect(200)
        .end(function(signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Get a offer from the other user
          agent.get('/api/offers-by/' + user2Id)
            .expect(200)
            .end(function(offerGetErr, offerGetRes) {
              // Handle offer get error
              if (offerGetErr) return done(offerGetErr);

              // Set assertions
              offerGetRes.body.should.be.instanceof(Array).and.have.lengthOf(1);
              offerGetRes.body[0]._id.should.equal(offer2._id.toString());
              offerGetRes.body[0].status.should.equal(offer2.status);
              offerGetRes.body[0].type.should.equal(offer2.type);
              offerGetRes.body[0].description.should.equal(offer2.description);
              offerGetRes.body[0].noOfferDescription.should.equal(offer2.noOfferDescription);
              offerGetRes.body[0].maxGuests.should.equal(offer2.maxGuests);
              offerGetRes.body[0].location.should.be.instanceof(Array).and.have.lengthOf(2);
              offerGetRes.body[0].location[0].should.be.approximately(offer2.locationFuzzy[0], 0.0000000000001);
              offerGetRes.body[0].location[1].should.be.approximately(offer2.locationFuzzy[1], 0.0000000000001);
              offerGetRes.body[0].user.should.equal(offer2.user.toString());
              should.not.exist(offerGetRes.body[0].locationFuzzy);
              should.not.exist(offerGetRes.body[0].updated);
              should.not.exist(offerGetRes.body[0].created);

              // Call the assertion callback
              return done();
            });

        });
    });

  });

  describe('Deleting offer', function() {
    it('should not be able to delete offer if not authenticated', function(done) {
      agent.delete('/api/offers')
        .expect(403)
        .end(function(offerSaveErr, offerSaveRes) {

          offerSaveRes.body.message.should.equal('Forbidden.');

          // Call the assertion callback
          return done(offerSaveErr);
        });
    });

    it('should not be able to delete offer of other user', function(done) {
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function(signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Save a new offer
          agent.delete('/api/offers/' + offer2Id)
            .send(offer2)
            .expect(403)
            .end(function(offerSaveErr) {
              // Handle offer save error
              if (offerSaveErr) return done(offerSaveErr);

              Offer.findOne({
                _id: offer2Id
              }, function(err, offer) {
                should.not.exist(err);
                should.exist(offer);
                return done();
              });
            });

        });
    });

    it('should be able to delete offer if authenticated', function(done) {
      agent.post('/api/auth/signin')
        .send(credentials2)
        .expect(200)
        .end(function(signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Save a new offer
          agent.delete('/api/offers/' + offer2Id)
            .send(offer2)
            .expect(200)
            .end(function(offerSaveErr) {
              // Handle offer save error
              if (offerSaveErr) return done(offerSaveErr);

              Offer.findOne({
                _id: offer2Id
              }, function(err, offer) {
                should.not.exist(err);
                should.not.exist(offer);
                return done();
              });
            });

        });
    });

  });

  describe('Creating offer', function() {

    it('should not be able to save offer if not authenticated', function(done) {
      agent.post('/api/offers')
        .send(offer1)
        .expect(403)
        .end(function(offerSaveErr, offerSaveRes) {

          offerSaveRes.body.message.should.equal('Forbidden.');

          // Call the assertion callback
          return done(offerSaveErr);
        });
    });

    it('should be able to create offer if authenticated', function(done) {
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function(signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Save a new offer
          agent.post('/api/offers')
            .send(offer1)
            .expect(200)
            .end(function(offerSaveErr, offerSaveRes) {
              // Handle offer save error
              if (offerSaveErr) return done(offerSaveErr);

              // Set assertions
              offerSaveRes.body.message.should.equal('Offer saved.');

              return done();
            });
        });
    });

    it('should not able to change offer type when updating offer', function(done) {
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function(signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Save a new offer
          agent.post('/api/offers')
            .send(offer1)
            .expect(200)
            .end(function(offerSaveErr) {
              // Handle offer save error
              if (offerSaveErr) return done(offerSaveErr);

              // Get id for offer we just saved
              Offer.findOne({
                user: user1Id
              }, function(offerFindErr, offer) {
                // Handle error
                if (offerFindErr) return done(offerFindErr);

                // Modify offer
                var modifiedOffer = offer1;
                modifiedOffer.type = 'meet';

                // Update offer
                agent.put('/api/offers/' + offer._id)
                  .send(modifiedOffer)
                  .expect(400)
                  .end(function(offerSaveErr, offerSaveRes) {
                    // Handle offer save error
                    if (offerSaveErr) return done(offerSaveErr);

                    offerSaveRes.body.message.should.equal('You cannot update offer type.');

                    Offer.find({
                      user: user1Id
                    }, function(err, offers) {
                      offers.length.should.equal(1);
                      offers[0].type.should.equal('host');
                      return done(err);
                    });
                  });
              });
            });
        });
    });

    it('should be able to create offer if authenticated', function(done) {
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function(signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Save a new offer
          agent.post('/api/offers')
            .send(offer1)
            .expect(200)
            .end(function(offerSaveErr) {
              // Handle offer save error
              if (offerSaveErr) return done(offerSaveErr);

              // Get a offer
              agent.get('/api/offers-by/' + user1Id)
                .expect(200)
                .end(function(offerGetErr, offerGetRes) {
                  // Handle offer get error
                  if (offerGetErr) return done(offerGetErr);

                  // Set assertions
                  offerGetRes.body.should.be.instanceof(Array).and.have.lengthOf(1);
                  offerGetRes.body[0]._id.should.not.be.empty();
                  offerGetRes.body[0].status.should.equal(offer1.status);
                  offerGetRes.body[0].description.should.equal(offer1.description);
                  offerGetRes.body[0].noOfferDescription.should.equal(offer1.noOfferDescription);
                  offerGetRes.body[0].maxGuests.should.equal(offer1.maxGuests);
                  offerGetRes.body[0].location.should.be.instanceof(Array).and.have.lengthOf(2);
                  offerGetRes.body[0].location[0].should.be.approximately(offer1.location[0], 0.0000000000001);
                  offerGetRes.body[0].location[1].should.be.approximately(offer1.location[1], 0.0000000000001);
                  offerGetRes.body[0].user.should.equal(user1Id.toString());
                  should.not.exist(offerGetRes.body[0].locationFuzzy);
                  should.not.exist(offerGetRes.body[0].updated);

                  // Call the assertion callback
                  return done();
                });
            });
        });
    });

    it('should be able to create offer without status and status should default to "yes"', function(done) {
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function(signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          var offerWithoutStatus = offer1;
          delete offerWithoutStatus.status;

          // Save a new offer
          agent.post('/api/offers')
            .send(offerWithoutStatus)
            .expect(200)
            .end(function(offerSaveErr) {
              if (offerSaveErr) return done(offerSaveErr);

              // Get the offer
              agent.get('/api/offers-by/' + user1Id)
                .expect(200)
                .end(function(offerGetErr, offerGetRes) {
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

    it('should not be able to create offer without type', function(done) {
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function(signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          var offerWithoutType = offer1;
          delete offerWithoutType.type;

          // Save a new offer
          agent.post('/api/offers')
            .send(offerWithoutType)
            .expect(400)
            .end(function(offerSaveErr, offerSaveRes) {
              if (offerSaveErr) return done(offerSaveErr);

              offerSaveRes.body.message.should.equal('Missing or invalid offer type.');

              return done();
            });
        });
    });

    it('should not be able to create offer without location', function(done) {
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function(signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          var offerWithoutLocation = offer1;
          delete offerWithoutLocation.location;

          // Save a new offer
          agent.post('/api/offers')
            .send(offerWithoutLocation)
            .expect(400)
            .end(function(offerSaveErr, offerSaveRes) {

              offerSaveRes.body.message.should.equal('Missing offer location.');

              // Call the assertion callback
              return done(offerSaveErr);
            });
        });
    });

  });

  describe('Updating offer', function() {

    it('should not be able to update offer if not authenticated', function(done) {
      agent.put('/api/offers/' + offer2Id)
        .send(offer2)
        .expect(403)
        .end(function(offerSaveErr, offerSaveRes) {

          offerSaveRes.body.message.should.equal('Forbidden.');

          // Call the assertion callback
          return done(offerSaveErr);
        });
    });

    it('should be able to update existing offer', function(done) {
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function(signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Save a new offer
          agent.post('/api/offers')
            .send(offer1)
            .expect(200)
            .end(function(offerSaveErr) {
              // Handle offer save error
              if (offerSaveErr) return done(offerSaveErr);

              // Get id for offer we just saved
              Offer.findOne({
                user: user1Id
              }, function(offerFindErr, offer) {
                // Handle error
                if (offerFindErr) return done(offerFindErr);

                // Modify offer
                offer.description = 'MODIFIED';
                offer.noOfferDescription = 'MODIFIED';

                // Store this for later comparison
                var previousUpdated = offer.updated;

                // Update offer
                agent.put('/api/offers/' + offer._id)
                  .send(offer)
                  .expect(200)
                  .end(function(offerPutErr, offerPutRes) {
                    // Handle offer put error
                    if (offerPutErr) return done(offerPutErr);

                    offerPutRes.body.message.should.equal('Offer updated.');

                    Offer.findOne({
                      _id: offer._id
                    }, function(err, offerNew) {
                      offerNew.description.should.equal('MODIFIED');
                      offerNew.noOfferDescription.should.equal('MODIFIED');
                      offerNew.updated.should.not.equal(previousUpdated);
                      return done(err);
                    });
                  });
              });
            });
        });
    });

    it('should remove reactivation flag field when updating offer', function(done) {
      agent.post('/api/auth/signin')
        .send(credentials2)
        .expect(200)
        .end(function(signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Add field to offer
          offer2.reactivateReminderSent = new Date();
          offer2.save(function(offerSaveErr, offerSavedRes) {
            // Handle offer save error
            if (offerSaveErr) return done(offerSaveErr);

            // Save a new offer
            agent.put('/api/offers/' + offerSavedRes._id)
              .send(offer2)
              .expect(200)
              .end(function(offerSaveErr) {
                // Handle offer save error
                if (offerSaveErr) return done(offerSaveErr);

                Offer.findOne({
                  user: user2Id
                }, function(err, offer) {
                  should.not.exist(offer.reactivateReminderSent);
                  return done(err);
                });
              });

          });
        });
    });

  });


  describe('Search offers', function() {

    it('should be able to get empty list from an area where there are no offers', function(done) {
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function(signinErr) {
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
            .end(function(offersGetErr, offersGetRes) {
              // Handle offer get error
              if (offersGetErr) return done(offersGetErr);

              // Set assertions
              offersGetRes.body.length.should.equal(0);

              // Call the assertion callback
              return done();
            });

        });
    });

    it('should return error when missing bounding box parameter', function(done) {
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function(signinErr) {
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

    it('should return error with invalid bounding box parameter (too large coordinate)', function(done) {
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function(signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Missing `southWestLng` paramter
          agent.get('/api/offers' +
              '?northEastLat=1000' +
              '&northEastLng=25.598493303571427' +
              '&southWestLat=-20.49068931208608' +
              '&southWestLng=-12.986188616071427'
            )
            .expect(400)
            .end(done);

        });
    });

    it('should return error with invalid bounding box parameter (string instead of coordinate)', function(done) {
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function(signinErr) {
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

    it('should not be able to get list of offers from an area if not authenticated', function(done) {
      // Get offers (around Berlin)
      agent.get('/api/offers' + queryBoundingBox)
        .expect(403)
        .end(function(offersGetErr, offersGetRes) {
          // Handle offer get error
          if (offersGetErr) return done(offersGetErr);

          offersGetRes.body.message.should.equal('Forbidden.');

          // Call the assertion callback
          return done();
        });
    });

    it('should be able to get list of offers from an area', function(done) {
      agent.post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function(signinErr) {
          // Handle signin error
          if (signinErr) return done(signinErr);

          // Get offers (around Berlin)
          agent.get('/api/offers' + queryBoundingBox)
            .expect(200)
            .end(function(offersGetErr, offersGetRes) {
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

    it('should include both meet and host offers when getting a list of offers from an area', function(done) {

      offerMeet.save(function(saveErr) {
        // Handle save error
        if (saveErr) return done(saveErr);

        agent.post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function(signinErr) {
            // Handle signin error
            if (signinErr) return done(signinErr);

            // Get offers (around Berlin)
            agent.get('/api/offers' + queryBoundingBox)
              .expect(200)
              .end(function(offersGetErr, offersGetRes) {
                // Handle offer get error
                if (offersGetErr) return done(offersGetErr);

                // Set assertions

                offersGetRes.body.should.be.instanceof(Array).and.have.lengthOf(3);

                // Count different offer types
                // This produces `{'host': 2, 'meet': 1}`
                var count = _.countBy(offersGetRes.body, function(offer) {
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

    it('should not include outdated meet offers when getting a list of offers from an area', function(done) {

      // Set date to past
      offerMeet.validUntil = moment().subtract(1, 'minute').toDate();

      offerMeet.save(function(saveErr) {
        // Handle save error
        if (saveErr) return done(saveErr);

        agent.post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function(signinErr) {
            // Handle signin error
            if (signinErr) return done(signinErr);

            // Get offers (around Berlin)
            agent.get('/api/offers' + queryBoundingBox)
              .expect(200)
              .end(function(offersGetErr, offersGetRes) {
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

    describe('Search offers by "types" filter', function() {

      it('should be able to get list of offers from an area filtered by type "host"', function(done) {
        offerMeet.save(function(saveErr) {
          // Handle save error
          if (saveErr) return done(saveErr);

          agent.post('/api/auth/signin')
            .send(credentials)
            .expect(200)
            .end(function(signinErr) {
              // Handle signin error
              if (signinErr) return done(signinErr);

              // Get offers (around Berlin)
              var filters = {
                types: ['host']
              };
              agent.get('/api/offers' + queryBoundingBox + '&filters=' + encodeURIComponent(JSON.stringify(filters)))
                .expect(200)
                .end(function(offersGetErr, offersGetRes) {
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

      it('should be able to get list of offers from an area filtered by type "meet"', function(done) {
        offerMeet.save(function(saveErr) {
          // Handle save error
          if (saveErr) return done(saveErr);

          agent.post('/api/auth/signin')
            .send(credentials)
            .expect(200)
            .end(function(signinErr) {
              // Handle signin error
              if (signinErr) return done(signinErr);

              // Get offers (around Berlin)
              var filters = {
                types: ['meet']
              };
              agent.get('/api/offers' + queryBoundingBox + '&filters=' + encodeURIComponent(JSON.stringify(filters)))
                .expect(200)
                .end(function(offersGetErr, offersGetRes) {
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

      it('should be able to get list of offers from an area filtered by non existing type', function(done) {
        offerMeet.save(function(saveErr) {
          // Handle save error
          if (saveErr) return done(saveErr);

          agent.post('/api/auth/signin')
            .send(credentials)
            .expect(200)
            .end(function(signinErr) {
              // Handle signin error
              if (signinErr) return done(signinErr);

              // Get offers (around Berlin)
              var filters = {
                types: ['foobar']
              };
              agent.get('/api/offers' + queryBoundingBox + '&filters=' + encodeURIComponent(JSON.stringify(filters)))
                .expect(200)
                .end(function(offersGetErr, offersGetRes) {
                  // Handle offer get error
                  if (offersGetErr) return done(offersGetErr);

                  // Set assertions
                  offersGetRes.body.should.be.instanceof(Array).and.have.lengthOf(3);

                  // Count different offer types
                  // This produces `{'host': 2, 'meet': 1}`
                  var count = _.countBy(offersGetRes.body, function(offer) {
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

    describe('Search offers by "tribes" filter', function() {

      it('should be able to get list of offers from an area filtered by one tribe', function(done) {
        agent.post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function(signinErr) {
            // Handle signin error
            if (signinErr) return done(signinErr);

            // Get offers (around Berlin)
            var filters = {
              tribes: [tribe2Id]
            };
            agent.get('/api/offers' + queryBoundingBox + '&filters=' + encodeURIComponent(JSON.stringify(filters)))
              .expect(200)
              .end(function(offersGetErr, offersGetRes) {
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

      it('should be able to get list of offers from an area filtered by tribes and not get tribe-less offers', function(done) {
        user3.member = [];
        user3.save(function (err, user3res) {
          should.not.exist(err);
          user3res.member.length.should.equal(0);
          agent.post('/api/auth/signin')
            .send(credentials)
            .expect(200)
            .end(function(signinErr) {
              // Handle signin error
              if (signinErr) return done(signinErr);

              // Get offers (around Berlin)
              var filters = {
                tribes: [tribe1Id, tribe2Id]
              };
              agent.get('/api/offers' + queryBoundingBox + '&filters=' + encodeURIComponent(JSON.stringify(filters)))
                .expect(200)
                .end(function(offersGetErr, offersGetRes) {
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

      it('should be able to get list of offers from an area filtered by many tribes', function(done) {
        agent.post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function(signinErr) {
            // Handle signin error
            if (signinErr) return done(signinErr);

            // Get offers (around Berlin)
            var filters = {
              tribes: [tribe1Id, tribe2Id]
            };
            agent.get('/api/offers' + queryBoundingBox + '&filters=' + encodeURIComponent(JSON.stringify(filters)))
              .expect(200)
              .end(function(offersGetErr, offersGetRes) {
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

      it('should be able able to send empty filter request', function(done) {
        agent.post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function(signinErr) {
            // Handle signin error
            if (signinErr) return done(signinErr);

            agent.get('/api/offers' + queryBoundingBox + '&filters=&types=')
              .expect(200)
              .end(function(offersGetErr, offersGetRes) {
                // Handle offer get error
                if (offersGetErr) return done(offersGetErr);

                // Set assertions
                offersGetRes.body.should.be.instanceof(Array).and.have.lengthOf(2);

                // Call the assertion callback
                return done();
              });
          });
      });

      it('should not be able to send non-json filter request', function(done) {
        agent.post('/api/auth/signin')
          .send(credentials)
          .expect(200)
          .end(function(signinErr) {
            // Handle signin error
            if (signinErr) return done(signinErr);

            agent.get('/api/offers' + queryBoundingBox + '&filters={wrong}')
              .expect(400)
              .end(function(offersGetErr, offersGetRes) {
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

  });

  afterEach(function(done) {
    // Uggggly pyramid revenge!
    User.remove().exec(function() {
      Tag.remove().exec(function() {
        Offer.remove().exec(done);
      });
    });
  });

});
