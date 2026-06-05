/**
 * Unit tests for the offers controller guard, validation, middleware and error
 * branches that the route tests do not exercise. Handlers are invoked directly
 * with mock req/res/next against the test database.
 */
const mongoose = require('mongoose');

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

  afterEach(utils.clearDatabase);

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
