/**
 * Unit tests for the offers controller guard, validation, middleware and error
 * branches that the route tests do not exercise. Handlers are invoked directly
 * with mock req/res/next against the test database.
 */
const mongoose = require('mongoose');
const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');

const offersController = require('../../server/controllers/offers.server.controller');
const userProfile = require('../../../users/server/controllers/users.profile.server.controller');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

const User = mongoose.model('User');
const Offer = mongoose.model('Offer');

function runHandler(invoke) {
  return new Promise(resolve => {
    const res = { statusCode: 200, body: null };
    const finish = () =>
      resolve({ res, nextCalled: res._next, nextArg: res._nextArg });
    res.status = function (code) {
      res.statusCode = code;
      return res;
    };
    res.send = function (body) {
      res.body = body;
      finish();
      return res;
    };
    res.json = function (body) {
      res.body = body;
      finish();
      return res;
    };
    const next = arg => {
      res._next = true;
      res._nextArg = arg;
      finish();
    };
    invoke(res, next);
  });
}

async function createOffer(userId, overrides = {}) {
  const offer = new Offer({
    type: 'host',
    location: [10, 20],
    user: userId,
    ...overrides,
  });
  await offer.save();
  return offer;
}

describe('Offers controller unit tests', () => {
  let owner;
  let stranger;

  beforeEach(async () => {
    [owner, stranger] = await utils.saveUsers(
      utils.generateUsers(2, { public: true }),
    );
  });

  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  describe('create', () => {
    it('responds with 403 without a user', async () => {
      const { res } = await runHandler(res =>
        offersController.create({ body: {} }, res),
      );
      res.statusCode.should.equal(403);
    });

    it('rejects a missing or invalid type', async () => {
      const { res } = await runHandler(res =>
        offersController.create(
          { user: owner, body: { type: 'invalid' } },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('rejects a missing location', async () => {
      const { res } = await runHandler(res =>
        offersController.create({ user: owner, body: { type: 'host' } }, res),
      );
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Missing offer location.');
    });

    it('creates a host offer', async () => {
      const { res } = await runHandler(res =>
        offersController.create(
          { user: owner, body: { type: 'host', location: [10, 20] } },
          res,
        ),
      );
      res.statusCode.should.equal(200);
      res.body.message.should.equal('Offer saved.');
    });

    it('creates a meet offer with a valid validUntil', async () => {
      const validUntil = require('moment')().add(5, 'days').toISOString();
      const { res } = await runHandler(res =>
        offersController.create(
          {
            user: owner,
            body: { type: 'meet', location: [10, 20], validUntil },
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);
    });

    it('creates a meet offer defaulting validUntil', async () => {
      const { res } = await runHandler(res =>
        offersController.create(
          {
            user: owner,
            body: { type: 'meet', location: [10, 20], validUntil: 'invalid' },
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);
    });

    it('returns 400 when saving a new offer fails', async () => {
      sinon.stub(Offer.prototype, 'save').callsFake(function (cb) {
        cb(new Error('save failed'));
      });

      const { res } = await runHandler(res =>
        offersController.create(
          { user: owner, body: { type: 'host', location: [10, 20] } },
          res,
        ),
      );
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Failed to save offer.');
    });
  });

  describe('update', () => {
    let offerReq;

    beforeEach(async () => {
      await createOffer(owner._id, { type: 'meet' });
      offerReq = await Offer.findOne({ user: owner._id }).populate(
        'user',
        '_id',
      );
    });

    it('responds with 403 for a non-owner', async () => {
      const { res } = await runHandler(res =>
        offersController.update(
          { user: stranger, offer: offerReq, body: { location: [1, 2] } },
          res,
        ),
      );
      res.statusCode.should.equal(403);
    });

    it('rejects a missing location', async () => {
      const { res } = await runHandler(res =>
        offersController.update(
          { user: owner, offer: offerReq, body: {} },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('rejects changing the offer type', async () => {
      const { res } = await runHandler(res =>
        offersController.update(
          {
            user: owner,
            offer: offerReq,
            body: { location: [1, 2], type: 'host' },
          },
          res,
        ),
      );
      res.statusCode.should.equal(400);
      res.body.message.should.equal('You cannot update offer type.');
    });

    it('updates an owned offer', async () => {
      const { res } = await runHandler(res =>
        offersController.update(
          {
            user: owner,
            offer: offerReq,
            body: { location: [1, 2], description: 'Updated' },
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);
      res.body.message.should.equal('Offer updated.');
    });

    it('defaults validUntil when updating a meet offer with invalid input', async () => {
      const { res } = await runHandler(res =>
        offersController.update(
          {
            user: owner,
            offer: offerReq,
            body: { location: [1, 2], validUntil: 'not-a-date' },
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);

      const reloaded = await Offer.findById(offerReq._id);
      reloaded.validUntil.should.be.a.Date();
    });

    it('accepts a valid validUntil when updating a meet offer', async () => {
      const validUntil = require('moment')().add(5, 'days').toISOString();
      const { res } = await runHandler(res =>
        offersController.update(
          {
            user: owner,
            offer: offerReq,
            body: { location: [1, 2], validUntil },
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);

      const reloaded = await Offer.findById(offerReq._id);
      reloaded.validUntil.should.be.a.Date();
    });

    it('returns 400 when saving an updated offer fails', async () => {
      sinon.stub(Offer.prototype, 'save').callsFake(function (cb) {
        cb(new Error('save failed'));
      });

      const { res } = await runHandler(res =>
        offersController.update(
          {
            user: owner,
            offer: offerReq,
            body: { location: [1, 2], description: 'Updated' },
          },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });
  });

  describe('update host offer', () => {
    it('strips validUntil when updating a host offer', async () => {
      const hostOffer = await createOffer(owner._id, { type: 'host' });
      const offerReq = await Offer.findById(hostOffer._id).populate(
        'user',
        '_id',
      );
      const validUntil = require('moment')().add(10, 'days').toISOString();

      const { res } = await runHandler(res =>
        offersController.update(
          {
            user: owner,
            offer: offerReq,
            body: { location: [1, 2], validUntil },
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);

      const reloaded = await Offer.findById(hostOffer._id);
      (
        reloaded.validUntil === undefined || reloaded.validUntil === null
      ).should.be.true();
    });
  });

  describe('delete', () => {
    it('responds with 403 for a non-owner', async () => {
      const offer = await createOffer(owner._id);
      const offerReq = await Offer.findById(offer._id).populate('user', '_id');
      const { res } = await runHandler(res =>
        offersController.delete({ user: stranger, offer: offerReq }, res),
      );
      res.statusCode.should.equal(403);
    });

    it('removes an owned offer', async () => {
      const offer = await createOffer(owner._id);
      const offerReq = await Offer.findById(offer._id).populate('user', '_id');
      const { res } = await runHandler(res =>
        offersController.delete({ user: owner, offer: offerReq }, res),
      );
      res.statusCode.should.equal(200);
      res.body.message.should.equal('Offer removed.');
    });

    it('returns 400 when removing an offer fails', async () => {
      const offer = await createOffer(owner._id);
      const offerReq = await Offer.findById(offer._id).populate('user', '_id');
      sinon.stub(Offer, 'findOneAndRemove').callsFake((query, cb) => {
        cb(new Error('remove failed'));
      });

      const { res } = await runHandler(res =>
        offersController.delete({ user: owner, offer: offerReq }, res),
      );
      res.statusCode.should.equal(400);
    });
  });

  describe('list', () => {
    const validCoords = {
      southWestLat: '10',
      southWestLng: '20',
      northEastLat: '30',
      northEastLng: '40',
    };

    it('responds with 403 without a user', async () => {
      const { res } = await runHandler(res =>
        offersController.list({ query: {} }, res),
      );
      res.statusCode.should.equal(403);
    });

    it('rejects invalid coordinates', async () => {
      const { res } = await runHandler(res =>
        offersController.list({ user: owner, query: {} }, res),
      );
      res.statusCode.should.equal(400);
    });

    it('rejects unparseable filters', async () => {
      const { res } = await runHandler(res =>
        offersController.list(
          { user: owner, query: { ...validCoords, filters: '{bad json' } },
          res,
        ),
      );
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Could not parse filters.');
    });

    it('rejects invalid tribe ids in filters', async () => {
      const { res } = await runHandler(res =>
        offersController.list(
          {
            user: owner,
            query: {
              ...validCoords,
              filters: JSON.stringify({ tribes: ['not-an-id'] }),
            },
          },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('returns 400 when the map query fails', async () => {
      const ownerDoc = await User.findById(owner._id);
      sinon.stub(Offer, 'aggregate').returns({
        exec: () => Promise.reject(new Error('aggregate failed')),
      });

      const { res } = await runHandler(res =>
        offersController.list(
          {
            user: ownerDoc,
            query: {
              ...validCoords,
              filters: JSON.stringify({ types: ['host'] }),
            },
          },
          res,
        ),
      );
      res.statusCode.should.equal(400);
    });

    it('returns a feature collection', async () => {
      const ownerDoc = await User.findById(owner._id);
      const { res } = await runHandler(res =>
        offersController.list(
          {
            user: ownerDoc,
            query: {
              ...validCoords,
              filters: JSON.stringify({
                types: ['host'],
                languages: ['eng'],
                seen: { days: 30 },
              }),
            },
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);
      res.body.type.should.equal('FeatureCollection');
    });

    it('accepts coordinates with leading whitespace', async () => {
      const ownerDoc = await User.findById(owner._id);
      const { res } = await runHandler(res =>
        offersController.list(
          {
            user: ownerDoc,
            query: {
              southWestLat: ' 10',
              southWestLng: ' 20',
              northEastLat: ' 30',
              northEastLng: ' 40',
              filters: JSON.stringify({ types: ['host'] }),
            },
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);
      res.body.type.should.equal('FeatureCollection');
    });

    it('filters offers by a single tribe', async () => {
      const tribe = await mongoose
        .model('Tribe')
        .create({ label: 'Offer Tribe' });
      const ownerDoc = await User.findById(owner._id);
      ownerDoc.member = [{ tribe: tribe._id, since: new Date() }];
      await ownerDoc.save();
      await createOffer(owner._id, { type: 'host' });

      const { res } = await runHandler(res =>
        offersController.list(
          {
            user: ownerDoc,
            query: {
              ...validCoords,
              filters: JSON.stringify({ tribes: [tribe._id.toString()] }),
            },
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);
      res.body.type.should.equal('FeatureCollection');
    });

    it('respects showOnlyInMyCircles on offers', async () => {
      const tribe = await mongoose
        .model('Tribe')
        .create({ label: 'Circle Tribe' });
      const [member, outsider] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const memberDoc = await User.findById(member._id);
      memberDoc.member = [{ tribe: tribe._id, since: new Date() }];
      await memberDoc.save();
      const viewerDoc = await User.findById(outsider._id);

      await createOffer(member._id, {
        type: 'host',
        showOnlyInMyCircles: true,
      });
      await createOffer(member._id, {
        type: 'host',
        showOnlyInMyCircles: false,
        location: [11, 21],
      });

      const { res } = await runHandler(res =>
        offersController.list(
          {
            user: viewerDoc,
            query: {
              ...validCoords,
              filters: JSON.stringify({ types: ['host'] }),
            },
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);
      res.body.features.length.should.equal(1);
    });
  });

  describe('getOffer', () => {
    it('responds with 404 without an offer', async () => {
      const { res } = await runHandler(res =>
        offersController.getOffer({ user: owner }, res),
      );
      res.statusCode.should.equal(404);
    });

    it('returns a sanitized offer', async () => {
      const offer = await createOffer(owner._id);
      const offerReq = await Offer.findById(offer._id).populate(
        'user',
        userProfile.userListingProfileFields,
      );
      const { res } = await runHandler(res =>
        offersController.getOffer({ user: owner, offer: offerReq }, res),
      );
      res.statusCode.should.equal(200);
      res.body.type.should.equal('host');
    });

    it('returns 400 when populating tribe memberships fails', async () => {
      const offer = await createOffer(owner._id);
      const offerReq = await Offer.findById(offer._id).populate(
        'user',
        userProfile.userListingProfileFields,
      );
      offerReq.user.member = [{ tribe: new mongoose.Types.ObjectId() }];

      sinon
        .stub(User, 'populate')
        .callsFake((doc, options, cb) => cb(new Error('populate failed')));

      const { res } = await runHandler(res =>
        offersController.getOffer({ user: owner, offer: offerReq }, res),
      );
      res.statusCode.should.equal(400);
    });

    it('returns an offer when the owner has no tribe memberships', async () => {
      const offer = await createOffer(owner._id);
      const offerReq = await Offer.findById(offer._id).populate(
        'user',
        userProfile.userListingProfileFields,
      );
      offerReq.user.member = [];

      const { res } = await runHandler(res =>
        offersController.getOffer({ user: owner, offer: offerReq }, res),
      );
      res.statusCode.should.equal(200);
      res.body.type.should.equal('host');
    });

    it('returns an offer when tribe memberships are undefined', async () => {
      const offer = await createOffer(owner._id);
      const offerReq = await Offer.findById(offer._id).populate(
        'user',
        userProfile.userListingProfileFields,
      );
      delete offerReq.user.member;

      const { res } = await runHandler(res =>
        offersController.getOffer({ user: owner, offer: offerReq }, res),
      );
      res.statusCode.should.equal(200);
      res.body.type.should.equal('host');
    });
  });

  describe('listOffersByUser', () => {
    it('returns the offers attached to the request', async () => {
      const { res } = await runHandler(res =>
        offersController.listOffersByUser({ offers: [{ a: 1 }] }, res),
      );
      res.body.should.deepEqual([{ a: 1 }]);
    });
  });

  describe('offersByUserId', () => {
    it('responds with 403 without a user', async () => {
      const { res } = await runHandler((res, next) =>
        offersController.offersByUserId({}, res, next, owner._id.toString()),
      );
      res.statusCode.should.equal(403);
    });

    it('responds with 400 for an invalid id', async () => {
      const { res } = await runHandler((res, next) =>
        offersController.offersByUserId({ user: owner }, res, next, 'bad-id'),
      );
      res.statusCode.should.equal(400);
    });

    it('responds with 404 when there are no offers', async () => {
      const { res } = await runHandler((res, next) =>
        offersController.offersByUserId(
          { user: owner, query: {} },
          res,
          next,
          new mongoose.Types.ObjectId().toString(),
        ),
      );
      res.statusCode.should.equal(404);
    });

    it('calls next and attaches offers filtered by type', async () => {
      await createOffer(owner._id, { type: 'host' });
      const ownerDoc = await User.findById(owner._id);
      const { nextCalled } = await runHandler((res, next) =>
        offersController.offersByUserId(
          { user: ownerDoc, query: { types: 'host' } },
          res,
          next,
          owner._id.toString(),
        ),
      );
      nextCalled.should.be.true();
    });

    it('passes lookup errors to next', async () => {
      sinon.stub(Offer, 'find').callsFake((query, cb) => {
        cb(new Error('lookup failed'));
      });

      const { nextArg } = await runHandler((res, next) =>
        offersController.offersByUserId(
          { user: owner, query: {} },
          res,
          next,
          owner._id.toString(),
        ),
      );
      nextArg.message.should.equal('lookup failed');
    });
  });

  describe('offerById', () => {
    it('responds with 403 without a user', async () => {
      const { res } = await runHandler((res, next) =>
        offersController.offerById(
          {},
          res,
          next,
          new mongoose.Types.ObjectId().toString(),
        ),
      );
      res.statusCode.should.equal(403);
    });

    it('responds with 400 for an invalid id', async () => {
      const { res } = await runHandler((res, next) =>
        offersController.offerById({ user: owner }, res, next, 'bad-id'),
      );
      res.statusCode.should.equal(400);
    });

    it('responds with 404 for a missing offer', async () => {
      const { res } = await runHandler((res, next) =>
        offersController.offerById(
          { user: owner },
          res,
          next,
          new mongoose.Types.ObjectId().toString(),
        ),
      );
      res.statusCode.should.equal(404);
    });

    it('calls next and attaches the offer', async () => {
      const offer = await createOffer(owner._id);
      const { nextCalled } = await runHandler((res, next) =>
        offersController.offerById(
          { user: owner },
          res,
          next,
          offer._id.toString(),
        ),
      );
      nextCalled.should.be.true();
    });

    it('calls next(err) when attaching the offer fails', async () => {
      const asyncLib = require('async');
      const failingOffersController = proxyquire(
        '../../server/controllers/offers.server.controller',
        {
          async: {
            ...asyncLib,
            waterfall(tasks, callback) {
              callback(new Error('attach failed'));
            },
          },
        },
      );

      const { nextCalled, nextArg } = await runHandler((res, next) =>
        failingOffersController.offerById(
          { user: owner },
          res,
          next,
          new mongoose.Types.ObjectId().toString(),
        ),
      );
      nextCalled.should.be.true();
      nextArg.should.be.Error();
      nextArg.message.should.equal('attach failed');
    });
  });

  describe('removeAllByUserId', () => {
    it('removes offers without error', done => {
      offersController.removeAllByUserId(new mongoose.Types.ObjectId(), err => {
        (err === null || err === undefined).should.be.true();
        done();
      });
    });
  });
});
