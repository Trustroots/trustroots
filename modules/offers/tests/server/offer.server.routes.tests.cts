import type {
  Credentials,
  OfferDocument,
  OfferModel,
  OfferRecord,
  TestAgent,
  TestExpressApp,
  TestExpressModule,
  TribeDocument,
  TribeModel,
  TribeRecord,
  UserModel,
  UserModelDocument,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';
const should: typeof import('should') = require('should');
const request: typeof import('supertest') = require('supertest');
const moment: typeof import('moment') = require('moment');
const mongoose: typeof import('mongoose') = require('mongoose');
const express: TestExpressModule = require('./../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil') = require('../../../../testutils/server/data.server.testutil');
const User = mongoose.model<UserRecord, UserModel>('User');
const Offer = mongoose.model<OfferRecord, OfferModel>('Offer');
const Tribe = mongoose.model<TribeRecord, TribeModel>('Tribe');

type OfferQueryFilter = import('mongoose').QueryFilter<OfferRecord>;

async function findOneOffer(
  filter: OfferQueryFilter,
): Promise<OfferDocument | null> {
  return Offer.findOne(filter);
}

async function findOffers(filter: OfferQueryFilter): Promise<OfferDocument[]> {
  return Offer.find(filter);
}

function assertPresent<T>(value: T | null | undefined): asserts value is T {
  should.exist(value);
}

/**
 * Globals
 */
let app: TestExpressApp;
let agent: TestAgent;
let credentials: Credentials;
let credentials2: Credentials;
let user1: UserModelDocument;
let user2: UserModelDocument;
let user3: UserModelDocument;
let user1Id: UserModelDocument['_id'];
let user2Id: UserModelDocument['_id'];
let user3Id: UserModelDocument['_id'];
let offer1: OfferRecord;
let offer2: OfferDocument;
let offer2Id: OfferDocument['_id'];
let offer3: OfferDocument;
let tribe1: TribeDocument;
let tribe2: TribeDocument;
let tribe1Id: TribeDocument['_id'];
let tribe2Id: TribeDocument['_id'];
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
 * Plain request payload for a meet offer; Mongoose documents can't be sent as request bodies
 */
function meetOfferPayload(overrides?: Partial<OfferRecord>): OfferRecord {
  return Object.assign(
    {
      type: 'meet',
      description: '<p>Dinner party!</p>',
      location: testLocations.Europe.location,
    },
    overrides,
  );
}

/**
 * Time window in which a defaulted `validUntil` ("30 days from now") has to fall,
 * given the moments just before and after the request was made
 */
function expectDefaultValidUntil(
  validUntil: Date | undefined,
  before: Date,
  after: Date,
): asserts validUntil is Date {
  assertPresent(validUntil);
  validUntil.should.be.instanceof(Date);
  validUntil
    .getTime()
    .should.be.within(
      moment(before).add(30, 'days').valueOf(),
      moment(after).add(30, 'days').valueOf(),
    );
}

async function signIn(user: Credentials) {
  await agent.post('/api/auth/signin').send(user).expect(200);
}

async function postMeetOffer(payload: OfferRecord) {
  const before = new Date();
  await agent.post('/api/offers').send(payload).expect(200);
  const after = new Date();
  const offer = await Offer.findOne({ user: user1Id });
  assertPresent(offer);
  return { offer, before, after };
}

async function putOffer(
  offerId: OfferDocument['_id'],
  payload: Partial<OfferRecord>,
) {
  const before = new Date();
  await agent
    .put('/api/offers/' + offerId)
    .send(payload)
    .expect(200);
  const after = new Date();
  const offer = await Offer.findById(offerId);
  assertPresent(offer);
  return { offer, before, after };
}

async function saveMeetOffer(validUntil: Date) {
  return new Offer(
    meetOfferPayload({ user: user1Id, validUntil, updated: new Date() }),
  ).save();
}

/**
 * Offer routes tests
 */
describe('Offer CRUD tests', function () {
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
      location: [52.49898120929877, 13.41832995414733],
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
    const savedTribe1 = await tribe1.save();
    tribe1Id = savedTribe1._id;

    const savedTribe2 = await tribe2.save();
    tribe2Id = savedTribe2._id;

    // Save user 1 (without tribe membership)
    const user1res = await utils.saveUserWithCachedPassword(user1);
    user1Id = user1res._id;

    // Save user 2 (with tribe membership)
    user2.member = [
      {
        tribe: tribe2Id,
        since: new Date(),
      },
    ];
    const user2res = await utils.saveUserWithCachedPassword(user2);
    user2Id = user2res._id;

    // Save user 3 (with tribe membership)
    user3.member = [
      {
        tribe: tribe1Id,
        since: new Date(),
      },
    ];
    const user3res = await utils.saveUserWithCachedPassword(user3);
    user3Id = user3res._id;

    // Save hosting offer 2
    offer2.user = user2Id;
    const savedOffer2 = await offer2.save();
    offer2Id = savedOffer2._id;

    // Save hosting offer 3
    offer3.user = user3Id;
    await offer3.save();
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
              assertPresent(offer2.locationFuzzy);
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
              assertPresent(offer2.locationFuzzy);
              assertPresent(offer2.user);
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
        .set('X-Trustroots-Request', '1')
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
            .send(offer2.toObject())
            .expect(403)
            .end(function (offerSaveErr) {
              // Handle offer save error
              if (offerSaveErr) return done(offerSaveErr);
              findOneOffer({ _id: offer2Id }).then(function (offer) {
                should.exist(offer);
                done();
              }, done);
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
            .send(offer2.toObject())
            .expect(200)
            .end(function (offerSaveErr) {
              // Handle offer save error
              if (offerSaveErr) return done(offerSaveErr);
              findOneOffer({ _id: offer2Id }).then(function (offer) {
                should.not.exist(offer);
                done();
              }, done);
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
          const offerWithoutLocation: Partial<OfferRecord> = offer1;
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

    it('should be able to set `validUntil`', async function () {
      await signIn(credentials);
      const validUntil = moment().add(5, 'days').toDate();

      const { offer } = await postMeetOffer(meetOfferPayload({ validUntil }));

      assertPresent(offer.validUntil);
      offer.validUntil.getTime().should.equal(validUntil.getTime());
    });

    it('should default to 30 days from now when trying to set `validUntil` to past', async function () {
      await signIn(credentials);
      const validUntil = moment().subtract(5, 'days').toDate();

      const { offer, before, after } = await postMeetOffer(
        meetOfferPayload({ validUntil }),
      );

      expectDefaultValidUntil(offer.validUntil, before, after);
    });

    it('should default to 30 days from now when trying to set `validUntil` to over 30 days from now', async function () {
      await signIn(credentials);
      const validUntil = moment().add(32, 'days').toDate();

      const { offer, before, after } = await postMeetOffer(
        meetOfferPayload({ validUntil }),
      );

      expectDefaultValidUntil(offer.validUntil, before, after);
    });

    it('should default to 30 days from now when not explicitly setting `validUntil`', async function () {
      await signIn(credentials);

      const { offer, before, after } = await postMeetOffer(meetOfferPayload());

      expectDefaultValidUntil(offer.validUntil, before, after);
    });
  });
  describe('Updating offer', function () {
    it('should not be able to update offer if not authenticated', function (done) {
      agent
        .put('/api/offers/' + offer2Id)
        .send(offer2.toObject())
        .expect(403)
        .end(function (offerSaveErr, offerSaveRes) {
          offerSaveRes.body.message.should.equal('Forbidden.');

          // Call the assertion callback
          return done(offerSaveErr);
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
            .send(offer2.toObject())
            .expect(403)
            .end(function (offerSaveErr) {
              // Handle offer save error
              if (offerSaveErr) return done(offerSaveErr);
              findOneOffer({ _id: offer2Id }).then(function (offer) {
                assertPresent(offer);
                assertPresent(offer.description);
                offer.description.should.not.equal(offer2.description);
                done();
              }, done);
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
              findOneOffer({ user: user1Id }).then(function (offer) {
                assertPresent(offer);

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
                    findOffers({ user: user1Id }).then(function (offers) {
                      offers.length.should.equal(1);
                      const [savedOffer] = offers;
                      assertPresent(savedOffer);
                      assertPresent(savedOffer.type);
                      savedOffer.type.should.equal('host');
                      done();
                    }, done);
                  });
              }, done);
            });
        });
    });

    it('should be able to update existing offer', async function () {
      await signIn(credentials);
      await agent.post('/api/offers').send(offer1).expect(200);
      const saved = await Offer.findOne({ user: user1Id });
      assertPresent(saved);
      const previousUpdated = moment().subtract(1, 'day').toDate();
      await Offer.updateOne({ _id: saved._id }, { updated: previousUpdated });

      const res = await agent
        .put('/api/offers/' + saved._id)
        .send({
          status: saved.status,
          location: saved.location,
          description: 'MODIFIED',
          noOfferDescription: 'MODIFIED',
          showOnlyInMyCircles: true,
        })
        .expect(200);

      res.body.message.should.equal('Offer updated.');
      const offer = await Offer.findById(saved._id);
      assertPresent(offer);
      assertPresent(offer.updated);
      assertPresent(offer.description);
      assertPresent(offer.noOfferDescription);
      assertPresent(offer.showOnlyInMyCircles);
      offer.description.should.equal('MODIFIED');
      offer.noOfferDescription.should.equal('MODIFIED');
      offer.showOnlyInMyCircles.should.equal(true);
      offer.updated.getTime().should.be.above(previousUpdated.getTime());
    });

    it('should be able to update `validUntil` value to 31 days from now', async function () {
      const saved = await saveMeetOffer(moment().add(2, 'days').toDate());
      await signIn(credentials);

      const { offer, before, after } = await putOffer(
        saved._id,
        meetOfferPayload({ validUntil: moment().add(31, 'days').toDate() }),
      );

      expectDefaultValidUntil(offer.validUntil, before, after);
    });

    it('should be keep `validUntil` value to previously saved when updating offer', async function () {
      const validUntil = moment().add(2, 'days').toDate();
      const saved = await saveMeetOffer(validUntil);
      await signIn(credentials);

      const { offer } = await putOffer(
        saved._id,
        meetOfferPayload({ validUntil }),
      );

      assertPresent(offer.validUntil);
      offer.validUntil.getTime().should.equal(validUntil.getTime());
    });

    it('should default to 30 days from now when updating without `validUntil`', async function () {
      const saved = await saveMeetOffer(moment().add(2, 'days').toDate());
      await signIn(credentials);

      const { offer, before, after } = await putOffer(
        saved._id,
        meetOfferPayload(),
      );

      expectDefaultValidUntil(offer.validUntil, before, after);
    });

    it('should default to 30 days from now when attempting to set `validUntil` value to over 30 days from now', async function () {
      const saved = await saveMeetOffer(moment().add(2, 'days').toDate());
      await signIn(credentials);

      const { offer, before, after } = await putOffer(
        saved._id,
        meetOfferPayload({ validUntil: moment().add(32, 'days').toDate() }),
      );

      expectDefaultValidUntil(offer.validUntil, before, after);
    });

    it('should default to 30 days from now when attempting to set `validUntil` value to past', async function () {
      const saved = await saveMeetOffer(moment().add(2, 'days').toDate());
      await signIn(credentials);

      const { offer, before, after } = await putOffer(
        saved._id,
        meetOfferPayload({ validUntil: moment().subtract(5, 'days').toDate() }),
      );

      expectDefaultValidUntil(offer.validUntil, before, after);
    });

    it('should remove reactivation flag field when updating offer', async function () {
      await signIn(credentials2);
      await Offer.updateOne(
        { _id: offer2Id },
        { reactivateReminderSent: new Date() },
      );

      const { offer } = await putOffer(offer2Id, {
        status: offer2.status,
        description: offer2.description,
        location: offer2.location,
      });

      should.not.exist(offer.reactivateReminderSent);
    });
  });
});
