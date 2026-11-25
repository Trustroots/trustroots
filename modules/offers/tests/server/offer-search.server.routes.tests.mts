import type {
  Credentials,
  TestAgent,
  TestExpressApp,
  TribeDocument,
  TribeModel,
  TribeRecord,
  UserModel,
  UserModelDocument,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';
import type { OfferServerRecord } from '../../server/models/offer.server.types.mts';
import should from 'should';
import request from 'supertest';
import { addDays, sub, subDays, subMonths, subYears } from 'date-fns';
import mongoose, { type HydratedDocument } from 'mongoose';
import config from '../../../../config/config.mts';
import express from './../../../../config/lib/express.mts';
import * as utils from '../../../../testutils/server/data.server.testutil.mts';
const User = mongoose.model<UserRecord, UserModel>('User');
const Offer = mongoose.model<OfferServerRecord>('Offer');
const Tribe = mongoose.model<TribeRecord, TribeModel>('Tribe');
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
let user2Id: UserModelDocument['_id'];
let user3Id: UserModelDocument['_id'];
let offer1: OfferServerRecord;
let offer2: HydratedDocument<OfferServerRecord>;
let offer2Id: HydratedDocument<OfferServerRecord>['_id'];
let offer3: HydratedDocument<OfferServerRecord>;
let offer3Id: HydratedDocument<OfferServerRecord>['_id'];
let offerMeet: HydratedDocument<OfferServerRecord>;
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
    location: [
      52.48556355813466, 13.489011526107788,
    ] as OfferServerRecord['location'],
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
interface OfferFeature {
  properties: {
    id: string;
    status: string;
    type: string;
  };
  geometry: {
    coordinates: number[];
  };
}
function assertPresent<T>(value: T | null | undefined): asserts value is T {
  should.exist(value);
}
function requestResult(
  test: import('supertest').Test,
): Promise<import('supertest').Response> {
  return new Promise((resolve, reject) => {
    test.end((error, response) => {
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
}
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
      validUntil: addDays(new Date(), 30),
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
    // Save data to the test db in the same order as the legacy waterfall.
    await tribe1.save();
    tribe1Id = tribe1._id;
    await tribe2.save();
    tribe2Id = tribe2._id;
    await user1.save();
    user2.member = [{ tribe: tribe2Id, since: new Date() }];
    await user2.save();
    user2Id = user2._id;
    user3.member = [{ tribe: tribe1Id, since: new Date() }];
    await user3.save();
    user3Id = user3._id;
    offer2.user = user2Id;
    await offer2.save();
    offer2Id = offer2._id;
    offer3.user = user3Id;
    await offer3.save();
    offer3Id = offer3._id;
    offerMeet.user = user2Id;
    offer1.user = user3Id;
  });
  afterEach(utils.clearDatabase);
  it('uses the same connection policy in web and mobile offer search', async function () {
    await mongoose.connection.collection('experiences').insertOne({
      userFrom: user1._id,
      userTo: user2Id,
      recommend: 'yes',
      public: false,
    });
    await utils.signIn(credentials, agent);
    const mobile = await request(app)
      .post('/api/mobile/v0/auth/signin')
      .send(credentials)
      .expect(200);
    const query = testLocations.Europe.queryBoundingBox;
    const filters = JSON.stringify({ connectionsOnly: true });
    const webResponse = await agent
      .get('/api/offers' + query)
      .query({ filters })
      .expect(200);
    const mobileResponse = await request(app)
      .get('/api/mobile/v0/offers' + query)
      .set('Authorization', `Bearer ${mobile.body.accessToken}`)
      .query({ filters })
      .expect(200);
    for (const response of [webResponse, mobileResponse]) {
      const features = response.body.features as OfferFeature[];
      features
        .map(feature => feature.properties.id)
        .should.eql([String(offer2Id)]);
    }
  });

  it('shares the offer search allowance across browser and mobile for each member', async function () {
    const originalLimit = config.offerSearchRequestsPerMinute;
    let limitedApp: TestExpressApp;
    try {
      config.offerSearchRequestsPerMinute = 2;
      limitedApp = await express.init(mongoose.connection);
    } finally {
      config.offerSearchRequestsPerMinute = originalLimit;
    }

    const browser = request.agent(limitedApp);
    await utils.signIn(credentials, browser);
    const signin = await request(limitedApp)
      .post('/api/mobile/v0/auth/signin')
      .send(credentials)
      .expect(200);
    const query = testLocations.Europe.queryBoundingBox;
    const webPath = '/api/offers' + query;
    const mobilePath = '/api/mobile/v0/offers' + query;
    const token = `Bearer ${signin.body.accessToken}`;

    await request(limitedApp).get(webPath).expect(403);
    await request(limitedApp).get(mobilePath).expect(401);
    await browser.get(webPath).expect(200);
    await request(limitedApp)
      .get(mobilePath)
      .set('Authorization', token)
      .expect(200);
    await browser.get(webPath).expect(429).expect('Retry-After', /^\d+$/);
    await request(limitedApp)
      .get(mobilePath)
      .set('Authorization', token)
      .expect(429)
      .expect('Retry-After', /^\d+$/);

    const otherBrowser = request.agent(limitedApp);
    await utils.signIn(credentials2, otherBrowser);
    await otherBrowser.get(webPath).expect(200);
  });

  it('lists eligible hosts with coarse activity and only visible public Experiences', async function () {
    await requestResult(
      agent.post('/api/auth/signin').send(credentials).expect(200),
    );
    await User.updateOne(
      { _id: user2Id },
      {
        $set: {
          displayName: 'Aster Host',
          seen: subMonths(new Date(), 2),
          birthdate: sub(new Date(), { years: 30, months: 1 }),
        },
      },
    );
    await User.updateOne(
      { _id: user3Id },
      { $set: { displayName: 'Briar Host' } },
    );
    await Offer.updateOne({ _id: offer3Id }, { $set: { status: 'maybe' } });
    await offerMeet.save();

    await mongoose.connection.collection('experiences').insertMany([
      { userFrom: user1._id, userTo: user3Id, public: true },
      {
        userFrom: user2Id,
        userTo: user3Id,
        public: true,
        removedAt: new Date(),
      },
      { userFrom: user3Id, userTo: user2Id, public: false },
      {
        userFrom: new mongoose.Types.ObjectId(),
        userTo: user2Id,
        public: true,
      },
    ]);

    const cityUrl =
      '/api/offers' +
      testLocations.Europe.queryBoundingBox +
      '&view=place-hosts';
    const { body: byName } = await requestResult(
      agent.get(cityUrl).expect(200),
    );
    byName.offers
      .map((offer: { _id: string }) => offer._id)
      .should.deepEqual([offer2Id.toString(), offer3Id.toString()]);
    byName.offers[0].should.containEql({
      activity: 'past-six-months',
      experienceCount: 0,
      age: 30,
    });
    byName.offers[0].user.should.containEql({
      _id: user2Id.toString(),
      displayName: 'Aster Host',
      username: credentials2.username,
    });
    byName.offers[0].user.should.not.have.property('birthdate');
    byName.offers[0].user.should.not.have.property('seen');
    byName.offers[0].location.should.deepEqual(offer2.locationFuzzy);
    byName.offers[1].should.containEql({
      activity: 'past-month',
      experienceCount: 1,
    });

    const { body: filtered } = await requestResult(
      agent.get(cityUrl + '&canHost=true').expect(200),
    );
    filtered.offers
      .map((offer: { _id: string }) => offer._id)
      .should.deepEqual([offer2Id.toString()]);

    await User.updateOne(
      { _id: user2Id },
      { $set: { seen: subYears(new Date(), 1) } },
    );
    await User.updateOne(
      { _id: user3Id },
      { $set: { seen: subYears(new Date(), 3) } },
    );
    const { body: older } = await requestResult(agent.get(cityUrl).expect(200));
    older.offers
      .map((offer: { activity: string }) => offer.activity)
      .should.deepEqual(['past-two-years', 'older']);
    const { body: withinTwoYears } = await requestResult(
      agent
        .get(cityUrl)
        .query({ filters: JSON.stringify({ seen: { months: 24 } }) })
        .expect(200),
    );
    withinTwoYears.offers
      .map((offer: { _id: string }) => offer._id)
      .should.deepEqual([offer2Id.toString()]);

    await User.updateOne(
      { _id: user3Id },
      { $addToSet: { blocked: user1._id } },
    );
    const { body: blocked } = await requestResult(
      agent.get(cityUrl).expect(200),
    );
    blocked.offers
      .map((offer: { _id: string }) => offer._id)
      .should.deepEqual([offer2Id.toString()]);

    await User.updateOne(
      { _id: user1._id },
      { $addToSet: { blocked: user2Id } },
    );
    const { body: blockedByViewer } = await requestResult(
      agent.get(cityUrl).expect(200),
    );
    blockedByViewer.offers.should.deepEqual([]);
  });

  it('orders city hosts by name, public Experiences or recent activity', async function () {
    await requestResult(
      agent.post('/api/auth/signin').send(credentials).expect(200),
    );
    const cityUrl =
      '/api/offers' +
      testLocations.Europe.queryBoundingBox +
      '&view=place-hosts';
    const idsFor = async (suffix = '') => {
      const { body } = await requestResult(
        agent.get(cityUrl + suffix).expect(200),
      );
      return body.offers.map((offer: { _id: string }) => offer._id);
    };
    const byUser2 = [offer2Id.toString(), offer3Id.toString()];
    const byUser3 = [offer3Id.toString(), offer2Id.toString()];
    const setSeen = async (user2Seen: Date, user3Seen: Date) => {
      await User.updateOne({ _id: user2Id }, { $set: { seen: user2Seen } });
      await User.updateOne({ _id: user3Id }, { $set: { seen: user3Seen } });
    };
    const recent = subDays(new Date(), 1);
    const old = subYears(new Date(), 1);

    // Names ignore case and fall back to the username when the display name is
    // empty or missing.
    await User.updateOne({ _id: user2Id }, { $set: { displayName: 'banana' } });
    await User.updateOne({ _id: user3Id }, { $set: { displayName: 'Cherry' } });
    (await idsFor()).should.deepEqual(byUser2);
    await User.updateOne({ _id: user2Id }, { $set: { displayName: 'Cherry' } });
    await User.updateOne({ _id: user3Id }, { $set: { displayName: 'banana' } });
    (await idsFor()).should.deepEqual(byUser3);
    await User.updateOne({ _id: user2Id }, { $set: { displayName: 'banana' } });
    await User.updateOne({ _id: user3Id }, { $set: { displayName: '' } });
    (await idsFor()).should.deepEqual(byUser2);
    await User.updateOne({ _id: user3Id }, { $unset: { displayName: 1 } });
    (await idsFor()).should.deepEqual(byUser2);
    await User.updateOne({ _id: user2Id }, { $set: { displayName: 'Aster' } });
    await User.updateOne({ _id: user3Id }, { $set: { displayName: 'Briar' } });
    (await idsFor()).should.deepEqual(byUser2);

    // User 3 has the only public Experience, but user 2 was seen most recently.
    await mongoose.connection.collection('experiences').insertOne({
      userFrom: user1._id,
      userTo: user3Id,
      public: true,
    });
    await setSeen(recent, old);
    (await idsFor('&sort=name')).should.deepEqual(byUser2);
    (await idsFor('&sort=experiences')).should.deepEqual(byUser3);
    (await idsFor('&sort=activity')).should.deepEqual(byUser2);

    // Now user 3 is both the most active and the most experienced.
    await setSeen(old, recent);
    (await idsFor()).should.deepEqual(byUser2);
    (await idsFor('&sort=experiences')).should.deepEqual(byUser3);
    (await idsFor('&sort=activity')).should.deepEqual(byUser3);

    // Equal counts fall back to name order rather than activity.
    await mongoose.connection.collection('experiences').deleteMany({});
    (await idsFor('&sort=experiences')).should.deepEqual(byUser2);
    (await idsFor('&sort=activity')).should.deepEqual(byUser3);
  });

  it('applies only a valid positive integer city host offset', async function () {
    await requestResult(
      agent.post('/api/auth/signin').send(credentials).expect(200),
    );
    const cityUrl =
      '/api/offers' +
      testLocations.Europe.queryBoundingBox +
      '&view=place-hosts';
    const idsFor = async (suffix: string) => {
      const { body } = await requestResult(
        agent.get(cityUrl + suffix).expect(200),
      );
      return body.offers.map((offer: { _id: string }) => offer._id);
    };
    const both = [offer2Id.toString(), offer3Id.toString()];

    (await idsFor('&offset=1')).should.deepEqual([offer3Id.toString()]);
    (await idsFor('&offset=2')).should.deepEqual([]);
    for (const offset of [
      '0',
      '-1',
      '-5',
      '1.5',
      'NaN',
      'Infinity',
      '',
      '9007199254740993',
    ]) {
      (await idsFor('&offset=' + encodeURIComponent(offset))).should.deepEqual(
        both,
      );
    }
    (await idsFor('&offset[]=1')).should.deepEqual(both);
    (await idsFor('&offset=1&offset=1')).should.deepEqual(both);
  });

  it('reports a next city host page only when more than one page remains', async function () {
    await requestResult(
      agent.post('/api/auth/signin').send(credentials).expect(200),
    );
    const cityUrl =
      '/api/offers' +
      testLocations.Europe.queryBoundingBox +
      '&view=place-hosts';
    const insertHosts = (count: number) =>
      mongoose.connection.collection('offers').insertMany(
        Array.from({ length: count }, () => ({
          user: user2Id,
          type: 'host',
          status: 'yes',
          showOnlyInMyCircles: false,
          locationFuzzy: testLocations.Europe.location,
        })),
      );
    const page = async (offset?: number) => {
      const { body } = await requestResult(
        agent
          .get(cityUrl + (offset === undefined ? '' : '&offset=' + offset))
          .expect(200),
      );
      return body as { offers: unknown[]; nextOffset?: number };
    };

    // Two hosts exist already, so 28 more fill exactly one page.
    await insertHosts(28);
    const full = await page();
    full.offers.should.have.length(30);
    full.should.not.have.property('nextOffset');

    // One extra host is only a lookahead for the next page.
    await insertHosts(1);
    const overflow = await page();
    overflow.offers.should.have.length(30);
    overflow.nextOffset!.should.equal(30);
    const last = await page(30);
    last.offers.should.have.length(1);
    last.should.not.have.property('nextOffset');

    // Later pages advance from their own offset.
    await insertHosts(30);
    const middle = await page(30);
    middle.offers.should.have.length(30);
    middle.nextOffset!.should.equal(60);
    (await page(60)).offers.should.have.length(1);
  });

  it('paginates city hosts in stable order', async function () {
    await requestResult(
      agent.post('/api/auth/signin').send(credentials).expect(200),
    );
    await mongoose.connection.collection('offers').insertMany(
      Array.from({ length: 30 }, () => ({
        user: user2Id,
        type: 'host',
        status: 'yes',
        showOnlyInMyCircles: false,
        locationFuzzy: testLocations.Europe.location,
      })),
    );
    const ids = (body: { offers: Array<{ _id: string }> }) =>
      body.offers.map(offer => offer._id);
    const cityUrl =
      '/api/offers' +
      testLocations.Europe.queryBoundingBox +
      '&view=place-hosts';
    const { body: page1 } = await requestResult(
      agent.get(cityUrl + '&offset=invalid').expect(200),
    );
    ids(page1).should.have.length(30);
    page1.nextOffset.should.equal(30);
    const { body: page2 } = await requestResult(
      agent.get(cityUrl + '&offset=' + page1.nextOffset).expect(200),
    );
    ids(page2).should.have.length(2);
    ids(page2).should.containEql(offer3Id.toString());
    new Set([...ids(page1), ...ids(page2)]).size.should.equal(32);
    page2.should.not.have.property('nextOffset');
  });

  it('saves volunteering on hosting offers and preserves it when updates omit it', async function () {
    await requestResult(
      agent.post('/api/auth/signin').send(credentials).expect(200),
    );
    const payload = { type: 'host', status: 'yes', location: [51, 12] };
    await requestResult(
      agent
        .post('/api/offers')
        .send({ ...payload, volunteering: true })
        .expect(200),
    );
    const own = await requestResult(
      agent.get(`/api/offers-by/${user1._id}?types=host`).expect(200),
    );
    const saved = own.body[0];
    saved.volunteering.should.equal(true);
    await requestResult(
      agent.put(`/api/offers/${saved._id}`).send(payload).expect(200),
    );
    const retained = await requestResult(
      agent.get(`/api/offers/${saved._id}`).expect(200),
    );
    retained.body.volunteering.should.equal(true);
    await requestResult(
      agent
        .put(`/api/offers/${saved._id}`)
        .send({ ...payload, volunteering: false })
        .expect(200),
    );
    const disabled = await requestResult(
      agent.get(`/api/offers/${saved._id}`).expect(200),
    );
    disabled.body.volunteering.should.equal(false);

    for (const volunteering of ['true', 'false', 1, 0, null, [], {}]) {
      for (const operation of [
        agent.post('/api/offers'),
        agent.put(`/api/offers/${saved._id}`),
      ]) {
        const invalid = await requestResult(
          operation.send({ ...payload, volunteering }).expect(400),
        );
        invalid.body.message.should.equal('Invalid volunteering option.');
      }
    }
    await requestResult(
      agent
        .post('/api/offers')
        .send({ ...payload, type: 'meet', volunteering: false })
        .expect(200),
    );
    const meetings = await requestResult(
      agent.get(`/api/offers-by/${user1._id}?types=meet`).expect(200),
    );
    for (const operation of [
      agent.post('/api/offers'),
      agent.put(`/api/offers/${meetings.body[0]._id}`),
    ]) {
      const invalid = await requestResult(
        operation
          .send({ ...payload, type: 'meet', volunteering: true })
          .expect(400),
      );
      invalid.body.message.should.equal('Invalid volunteering option.');
    }
  });

  it('narrows volunteering search to active eligible hosts and retains ordinary search', async function () {
    await requestResult(
      agent.post('/api/auth/signin').send(credentials).expect(200),
    );
    offer2.volunteering = true;
    await offer2.save();
    // A malformed historical meeting record must never match the host filter.
    offerMeet.volunteering = true;
    await offerMeet.save();
    const search = async (filters: Record<string, unknown>) => {
      const response = await requestResult(
        agent
          .get('/api/offers' + testLocations.Europe.queryBoundingBox)
          .query({ filters: JSON.stringify(filters) })
          .expect(200),
      );
      return (response.body.features as OfferFeature[]).map(
        feature => feature.properties.id,
      );
    };
    (await search({ volunteering: true })).should.eql([offer2._id.toString()]);
    (await search({ volunteering: true, types: ['meet'] })).should.eql([]);
    for (const volunteering of [false, 'true', 1]) {
      (await search({ volunteering })).should.containEql(offer3._id.toString());
    }
    await Offer.collection.updateOne(
      { _id: offer3._id },
      { $unset: { volunteering: '' } },
    );
    (await search({ volunteering: true })).should.eql([offer2._id.toString()]);
    (await search({})).should.containEql(offer3._id.toString());
    offer2.status = 'no';
    offer2.meetingStatus = 'yes';
    await offer2.save();
    (await search({ volunteering: true })).should.eql([]);
    offer2.status = 'maybe';
    await offer2.save();
    (await search({ volunteering: true })).should.eql([offer2._id.toString()]);
    offer2.volunteering = false;
    await offer2.save();
    (await search({ volunteering: true })).should.eql([]);
    (await search({ types: ['host'] })).should.containEql(
      offer2._id.toString(),
    );
  });

  it('keeps volunteering hosts subject to circle and member visibility restrictions', async function () {
    await requestResult(
      agent.post('/api/auth/signin').send(credentials).expect(200),
    );
    offer2.volunteering = true;
    await offer2.save();
    const visible = async () => {
      const response = await requestResult(
        agent
          .get('/api/offers' + testLocations.Europe.queryBoundingBox)
          .query({ filters: JSON.stringify({ volunteering: true }) })
          .expect(200),
      );
      return response.body.features.some(
        (feature: OfferFeature) =>
          feature.properties.id === offer2._id.toString(),
      );
    };
    (await visible()).should.equal(true);
    offer2.showOnlyInMyCircles = true;
    await offer2.save();
    (await visible()).should.equal(false);
    offer2.showOnlyInMyCircles = false;
    await offer2.save();
    user2.public = false;
    await user2.save();
    (await visible()).should.equal(false);
  });

  it('saves non-host meeting availability, shares fuzzy location and filters each state independently', async function () {
    await requestResult(
      agent.post('/api/auth/signin').send(credentials).expect(200),
    );
    offerMeet.status = 'no';
    offerMeet.meetingStatus = 'yes';
    await offerMeet.save();
    const payload = {
      type: 'host',
      status: 'no',
      meetingStatus: 'yes',
      location: [51, 12],
    };
    await requestResult(agent.post('/api/offers').send(payload).expect(200));
    const own = await requestResult(
      agent.get(`/api/offers-by/${user1._id}?types=host`).expect(200),
    );
    const saved = own.body[0];
    saved.meetingStatus.should.equal('yes');
    saved.status.should.equal('no');
    saved.location.should.eql([51, 12]);
    const search = async (types: string[]) => {
      const response = await requestResult(
        agent
          .get('/api/offers' + testLocations.Europe.queryBoundingBox)
          .query({ filters: JSON.stringify({ types }) })
          .expect(200),
      );
      return (response.body.features as OfferFeature[]).find(
        feature => feature.properties.id === saved._id,
      );
    };
    const meeting = await search(['meet']);
    assertPresent(meeting);
    meeting.properties.type.should.equal('meet');
    meeting.properties.status.should.equal('yes');
    meeting.geometry.coordinates.should.not.eql([12, 51]);
    should.not.exist(
      (
        await requestResult(
          agent
            .get('/api/offers' + testLocations.Europe.queryBoundingBox)
            .query({ filters: JSON.stringify({ types: ['meet'] }) })
            .expect(200),
        )
      ).body.features.find(
        (feature: OfferFeature) =>
          feature.properties.id === offerMeet._id.toString(),
      ),
    );
    should.not.exist(await search(['host']));
    should.exist(await search(['host', 'meet']));
    const stranger = request.agent(app);
    await requestResult(
      stranger.post('/api/auth/signin').send(credentials2).expect(200),
    );
    const read = await requestResult(
      stranger.get(`/api/offers/${saved._id}`).expect(200),
    );
    read.body.location.should.eql([...meeting.geometry.coordinates].reverse());
    read.body.status.should.equal('no');
    read.body.meetingStatus.should.equal('yes');
    for (const status of ['yes', 'maybe']) {
      await requestResult(
        agent
          .put(`/api/offers/${saved._id}`)
          .send({ ...payload, status })
          .expect(200),
      );
      (await search(['host']))!.properties.status.should.equal(status);
      (await search(['meet']))!.properties.type.should.equal('meet');
      (await search(['host', 'meet']))!.properties.type.should.equal('host');
    }
    await requestResult(
      agent
        .put(`/api/offers/${saved._id}`)
        .send({ ...payload, status: 'yes', meetingStatus: 'no' })
        .expect(200),
    );
    should.not.exist(await search(['meet']));
    should.exist(await search(['host']));
    await requestResult(
      agent
        .put(`/api/offers/${saved._id}`)
        .send({ ...payload, meetingStatus: 'no' })
        .expect(200),
    );
    should.not.exist(await search(['host', 'meet']));
    for (const meetingStatus of ['yes', 'maybe', 'no', 'not-set']) {
      await requestResult(
        agent
          .put(`/api/offers/${saved._id}`)
          .send({ ...payload, meetingStatus })
          .expect(200),
      );
      const result = await search(['meet']);
      if (meetingStatus === 'yes' || meetingStatus === 'maybe')
        should.exist(result);
      else should.not.exist(result);
      const updated = await requestResult(
        agent.get(`/api/offers/${saved._id}`).expect(200),
      );
      updated.body.meetingStatus.should.equal(meetingStatus);
      updated.body.status.should.equal('no');
    }
    for (const meetingStatus of [
      'true',
      true,
      false,
      1,
      null,
      '',
      'unknown',
      ['yes'],
    ]) {
      const createResponse = await requestResult(
        agent
          .post('/api/offers')
          .send({ ...payload, meetingStatus })
          .expect(400),
      );
      createResponse.body.message.should.equal('Invalid meeting availability.');
      const updateResponse = await requestResult(
        agent
          .put(`/api/offers/${saved._id}`)
          .send({ ...payload, meetingStatus })
          .expect(400),
      );
      updateResponse.body.message.should.equal('Invalid meeting availability.');
    }
  });

  it('applies existing visibility restrictions to ongoing meetings', async function () {
    offer2.status = 'no';
    offer2.meetingStatus = 'yes';
    await offer2.save();
    await requestResult(
      agent.post('/api/auth/signin').send(credentials).expect(200),
    );
    const visible = async () => {
      const response = await requestResult(
        agent
          .get('/api/offers' + testLocations.Europe.queryBoundingBox)
          .query({ filters: JSON.stringify({ types: ['meet'] }) })
          .expect(200),
      );
      return response.body.features.some(
        (feature: OfferFeature) =>
          feature.properties.id === offer2._id.toString(),
      );
    };
    (await visible()).should.equal(true);
    offer2.showOnlyInMyCircles = true;
    await offer2.save();
    (await visible()).should.equal(false);
    user1.member = [{ tribe: tribe2Id, since: new Date() }];
    await user1.save();
    (await visible()).should.equal(true);
    for (const roles of [
      ['user', 'suspended'],
      ['user', 'shadowban'],
    ]) {
      user2.roles = roles;
      await user2.save();
      (await visible()).should.equal(false);
    }
    user2.roles = ['user'];
    user2.public = false;
    await user2.save();
    (await visible()).should.equal(false);
  });

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
                offersGetRes.body.features
                  .map(
                    (offer: { properties: { type: string } }) =>
                      offer.properties.type,
                  )
                  .sort()
                  .should.eql(['host', 'host', 'meet']);
                // Call the assertion callback
                return done();
              });
          });
      })
      .catch(done);
  });
  it('should not include outdated meet offers when getting a list of offers from an area', function (done) {
    // Set date to past
    offerMeet.validUntil = sub(new Date(), { minutes: 1 });
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
                  offersGetRes.body.features
                    .map(
                      (offer: { properties: { type: string } }) =>
                        offer.properties.type,
                    )
                    .sort()
                    .should.eql(['host', 'host', 'meet']);
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
              assertPresent(offer2.locationFuzzy);
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
          should.not.exist(null);
          assertPresent(user3res.member);
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
                  assertPresent(offer2.locationFuzzy);
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
              assertPresent(offer2.locationFuzzy);
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
              assertPresent(offer3.locationFuzzy);
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
  });
  describe('Search offers by "seen" filter', function () {
    it('should be able to get list of offers from an area filtered by last seen', function (done) {
      user2.seen = sub(new Date(), {
        months: 2,
      });
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
    // Save tribe 3, then update the users' memberships in waterfall order.
    const tribe3 = await new Tribe({
      slug: 'tribe3',
      label: 'tribe3',
      color: '333333',
      count: 1,
      public: true,
    }).save();
    const tribe3Id = tribe3._id;
    user1.member = [
      { tribe: tribe1Id, since: new Date() },
      { tribe: tribe2Id, since: new Date() },
    ];
    await user1.save();
    user2.member = [
      { tribe: tribe2Id, since: new Date() },
      { tribe: tribe3Id, since: new Date() },
    ];
    await user2.save();
    user3.member = [{ tribe: tribe3Id, since: new Date() }];
    await user3.save();
    // Update the hosting offers.
    const o1 = await new Offer({
      ...offer1,
      user: user2Id,
      location: testLocations.Europe.location,
      showOnlyInMyCircles: true,
    }).save();
    const offer1Id = o1._id;
    offer2.user = user3Id;
    offer2.location = testLocations.Europe.location;
    offer2.showOnlyInMyCircles = true;
    await offer2.save();
    offer3.user = user3Id;
    offer3.location = testLocations.Europe.location;
    offer3.showOnlyInMyCircles = false;
    await offer3.save();
    await requestResult(
      agent.post('/api/auth/signin').send(credentials).expect(200),
    );
    const offersGetRes = await requestResult(
      agent
        .get('/api/offers' + testLocations.Europe.queryBoundingBox)
        .expect(200),
    );
    // Verify the offers.
    const features = offersGetRes.body.features as OfferFeature[];
    features.should.have.lengthOf(2);
    // The offers are returned in any order.
    let offerRes1: OfferFeature;
    let offerRes3: OfferFeature;
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
