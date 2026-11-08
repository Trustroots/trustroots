import type {
  OfferDocument,
  OfferModel,
  OfferRecord,
  TestConfigModule,
  UserDocument,
  UserModel,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';
import type { OfferPayload } from '../../shared/offer.js';
/**
 * Unit tests for the offers controller guard, validation, middleware and error
 * branches that the route tests do not exercise. Handlers are invoked directly
 * with mock req/res/next against the test database.
 */
const mongoose: typeof import('mongoose') = require('mongoose');

const sinon: typeof import('sinon') = require('sinon');
const winston: typeof import('winston') = require('winston');

const config: TestConfigModule = require('./../../../../config/config.mts');
const offersController: typeof import('./../../server/controllers/offers.server.controller.mjs') = require('./../../server/controllers/offers.server.controller.mjs');
const userProfile: typeof import('./../../../users/server/controllers/users.profile.server.controller.mjs') = require('./../../../users/server/controllers/users.profile.server.controller.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil') = require('../../../../testutils/server/data.server.testutil');
const should: typeof import('should') = require('should');

const User = mongoose.model<UserRecord, UserModel>('User');
const Offer = mongoose.model<OfferRecord, OfferModel>('Offer');

interface OfferResponseBody extends Record<string, unknown> {
  message: string;
  type: string;
  description: string;
  location: number[];
  noOfferDescription: string;
  features: unknown[];
}
interface MockOfferResponse {
  statusCode: number;
  body: OfferResponseBody;
  _next?: boolean;
  _nextArg?: unknown;
  status(code: number): MockOfferResponse;
  send(body: unknown): MockOfferResponse;
  json(body: unknown): MockOfferResponse;
}
type HandlerResult = {
  res: MockOfferResponse;
  nextCalled: boolean;
  nextArg: unknown;
};
function runHandler(
  invoke: (
    res: import('express').Response,
    next: (arg?: unknown) => void,
  ) => unknown,
): Promise<HandlerResult> {
  return new Promise(resolve => {
    const res = {} as MockOfferResponse;
    const finish = () =>
      resolve({ res, nextCalled: res._next === true, nextArg: res._nextArg });
    Object.assign(res, {
      statusCode: 200,
      body: {} as OfferResponseBody,
      status(code: number) {
        res.statusCode = code;
        return res;
      },
      send(body: unknown) {
        res.body = body as OfferResponseBody;
        finish();
        return res;
      },
      json(body: unknown) {
        res.body = body as OfferResponseBody;
        finish();
        return res;
      },
    });
    const next = (arg?: unknown) => {
      res._next = true;
      res._nextArg = arg;
      finish();
    };
    invoke(res as unknown as import('express').Response, next);
  });
}

function required<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) throw new Error('Expected value');
  return value as NonNullable<T>;
}

type PopulatedOffer = OfferDocument & {
  user: UserRecord & { _id: UserDocument['_id'] };
};
function populatedOffer(offer: OfferDocument | null): PopulatedOffer {
  return required(offer) as unknown as PopulatedOffer;
}

async function createOffer(
  userId: UserDocument['_id'],
  overrides: Partial<OfferRecord> = {},
): Promise<OfferDocument> {
  const offer = new Offer({
    type: 'host',
    location: [10, 20],
    user: userId,
    ...overrides,
  });
  await offer.save();
  return offer;
}

type ByUserRequest = Parameters<typeof offersController.offersByUserId>[0] & {
  offers?: Array<{ _id: unknown }>;
};
const idsOf = (...offers: OfferDocument[]) =>
  offers.map(offer => offer._id.toString()).sort();

describe('Offers controller unit tests', () => {
  let owner: UserDocument;
  let stranger: UserDocument;

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

    it('rejects offer types when schema enum values are unavailable', async () => {
      const typePath = Offer.schema.path(
        'type',
      ) as import('mongoose').SchemaType & { enumValues?: string[] };
      const enumValues = typePath.enumValues;
      typePath.enumValues = undefined;

      try {
        const { res } = await runHandler(res =>
          offersController.create(
            { user: owner, body: { type: 'host', location: [10, 20] } },
            res,
          ),
        );
        res.statusCode.should.equal(400);
      } finally {
        typePath.enumValues = enumValues;
      }
    });

    it('rejects a missing location', async () => {
      const { res } = await runHandler(res =>
        offersController.create({ user: owner, body: { type: 'host' } }, res),
      );
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Missing offer location.');
    });

    it('rejects the unchosen map starting location', async () => {
      const { res } = await runHandler(res =>
        offersController.create(
          {
            user: owner,
            body: {
              type: 'host',
              location: [48.6908333333, 9.14055555556],
            },
          },
          res,
        ),
      );
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Choose a location for your offer.');
    });

    it('allows a location near but distinct from the map starting point', async () => {
      const { res } = await runHandler(res =>
        offersController.create(
          {
            user: owner,
            body: { type: 'host', location: [48.6908333333, 9.141] },
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);
    });

    it('rejects an incomplete location', async () => {
      const { res } = await runHandler(res =>
        offersController.create(
          { user: owner, body: { type: 'host', location: [48.6908333333] } },
          res,
        ),
      );
      res.statusCode.should.equal(400);
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

    it('preserves numeric moment-compatible expiry input', async () => {
      const validUntil = Date.now() + 5 * 24 * 60 * 60 * 1000;
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
      const offer = required(await Offer.findOne({ user: owner._id }));
      required(offer.validUntil).getTime().should.equal(validUntil);
    });

    it('defaults meet offer expiry when max validity config is absent', async () => {
      sinon.stub(config, 'limits').value({});
      const controller = offersController;

      const { res } = await runHandler(res =>
        controller.create(
          {
            user: owner,
            body: { type: 'meet', location: [10, 20], validUntil: 'invalid' },
          },
          res,
        ),
      );
      res.statusCode.should.equal(200);
    });

    it('only treats the exact map starting point as unchosen', async () => {
      const [lat, lng] = [48.6908333333, 9.14055555556];
      const nearlyDefault: unknown[] = [
        [lat, lng, 5],
        [10, lng],
        { 0: lat, 1: lng },
        { 0: lat, 1: lng, length: 2 },
      ];
      for (const location of nearlyDefault) {
        const { res } = await runHandler(res =>
          offersController.create(
            { user: owner, body: { type: 'host', location } },
            res,
          ),
        );
        res.body.message.should.not.equal('Choose a location for your offer.');
      }
    });

    it('leaves the expiry off host offers whatever the request says', async () => {
      const validUntil = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
      const { res } = await runHandler(res =>
        offersController.create(
          {
            user: owner,
            body: { type: 'host', location: [10, 20], validUntil },
          },
          res,
        ),
      );

      res.statusCode.should.equal(200);
      const offer = required(await Offer.findOne({ user: owner._id }));
      should(offer.validUntil == null).be.true();
    });

    it('returns 400 when saving a new offer fails', async () => {
      const saveOffer = sinon.stub(
        Offer.prototype,
        'save',
      ) as unknown as import('sinon').SinonStub<
        [(error?: Error | null) => void],
        void
      >;
      saveOffer.callsFake(() => Promise.reject(new Error('save failed')));

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
    let offerReq: OfferDocument;

    beforeEach(async () => {
      await createOffer(owner._id, { type: 'meet' });
      offerReq = required(
        await Offer.findOne({ user: owner._id }).populate('user', '_id'),
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
      res.body.message.should.equal('Missing offer location.');
    });

    it('rejects changing an offer to the map starting location', async () => {
      const { res } = await runHandler(res =>
        offersController.update(
          {
            user: owner,
            offer: offerReq,
            body: { location: [48.6908333333, 9.14055555556] },
          },
          res,
        ),
      );
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Choose a location for your offer.');
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

    it('updates the optional offer fields accepted by the endpoint', async () => {
      const validUntil = require('moment')().add(5, 'days').toISOString();
      const { res } = await runHandler(res =>
        offersController.update(
          {
            user: owner,
            offer: offerReq,
            body: {
              location: [1, 2],
              status: 'yes',
              description: 'A fictional offer.',
              noOfferDescription: 'A fictional note.',
              maxGuests: 3,
              validUntil,
              showOnlyInMyCircles: true,
            },
          },
          res,
        ),
      );

      res.statusCode.should.equal(200);
      const updated = required(await Offer.findById(offerReq._id));
      required(updated.status).should.equal('yes');
      required(updated.description).should.equal('A fictional offer.');
      required(updated.noOfferDescription).should.equal('A fictional note.');
      required(updated.maxGuests).should.equal(3);
      required(updated.showOnlyInMyCircles).should.be.true();
    });

    it('preserves model validation for an unsupported status value', async () => {
      const { res } = await runHandler(res =>
        offersController.update(
          {
            user: owner,
            offer: offerReq,
            body: { location: [1, 2], status: 'invalid' },
          },
          res,
        ),
      );

      res.statusCode.should.equal(400);
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

      const reloaded = required(await Offer.findById(offerReq._id));
      required(reloaded.validUntil).should.be.a.Date();
    });
  });

  describe('update host offer', () => {
    it('strips validUntil when updating a host offer', async () => {
      const hostOffer = await createOffer(owner._id, { type: 'host' });
      const offerReq = populatedOffer(
        await Offer.findById(hostOffer._id).populate('user', '_id'),
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

      const reloaded = required(await Offer.findById(hostOffer._id));
      (
        reloaded.validUntil === undefined || reloaded.validUntil === null
      ).should.be.true();
    });
  });

  describe('delete', () => {
    it('responds with 403 for a non-owner', async () => {
      const offer = await createOffer(owner._id);
      const offerReq = populatedOffer(
        await Offer.findById(offer._id).populate('user', '_id'),
      );
      const { res } = await runHandler(res =>
        offersController.delete({ user: stranger, offer: offerReq }, res),
      );
      res.statusCode.should.equal(403);
    });

    it('removes an owned offer', async () => {
      const offer = await createOffer(owner._id);
      const offerReq = populatedOffer(
        await Offer.findById(offer._id).populate('user', '_id'),
      );
      const { res } = await runHandler(res =>
        offersController.delete({ user: owner, offer: offerReq }, res),
      );
      res.statusCode.should.equal(200);
      res.body.message.should.equal('Offer removed.');
    });

    it('removes only the requested offer', async () => {
      const otherOffer = await createOffer(stranger._id);
      const offer = await createOffer(owner._id);
      const offerReq = populatedOffer(
        await Offer.findById(offer._id).populate('user', '_id'),
      );

      await runHandler(res =>
        offersController.delete({ user: owner, offer: offerReq }, res),
      );

      should(await Offer.findById(offer._id)).be.null();
      should(await Offer.findById(otherOffer._id)).not.be.null();
    });

    it('returns 400 when removing an offer fails', async () => {
      const offer = await createOffer(owner._id);
      const offerReq = populatedOffer(
        await Offer.findById(offer._id).populate('user', '_id'),
      );
      sinon.stub(Offer, 'findOneAndDelete').rejects(new Error('remove failed'));

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

    it('rejects parseable filters that are not objects', async () => {
      const { res } = await runHandler(res =>
        offersController.list(
          { user: owner, query: { ...validCoords, filters: '123' } },
          res,
        ),
      );

      res.statusCode.should.equal(400);
      res.body.message.should.equal('Could not parse filters.');
    });

    it('accepts a JSON array as an empty filter object', async () => {
      const { res } = await runHandler(res =>
        offersController.list(
          { user: owner, query: { ...validCoords, filters: '[]' } },
          res,
        ),
      );

      res.statusCode.should.equal(200);
      res.body.should.deepEqual({ type: 'FeatureCollection', features: [] });
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
      const ownerDoc = required(await User.findById(owner._id));
      const aggregate = sinon.stub(Offer, 'aggregate');
      aggregate.returns({
        exec: () => Promise.reject(new Error('aggregate failed')),
      } as unknown as ReturnType<typeof aggregate>);

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
      const ownerDoc = required(await User.findById(owner._id));
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

    it('ignores invalid language filters', async () => {
      const ownerDoc = required(await User.findById(owner._id));
      const { res } = await runHandler(res =>
        offersController.list(
          {
            user: ownerDoc,
            query: {
              ...validCoords,
              filters: JSON.stringify({ languages: ['not-a-language'] }),
            },
          },
          res,
        ),
      );

      res.statusCode.should.equal(200);
      res.body.type.should.equal('FeatureCollection');
    });

    it('accepts coordinates with leading whitespace', async () => {
      const ownerDoc = required(await User.findById(owner._id));
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
      const ownerDoc = required(await User.findById(owner._id));
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

    interface SearchFeature {
      type: string;
      properties: {
        id: string;
        status?: string;
        type?: string;
        offer?: string | null;
      };
      geometry: { type: string; coordinates: number[] };
    }
    async function search(
      viewer: UserDocument,
      filters?: unknown,
      coordinates: Record<string, string> = validCoords,
    ) {
      const query = {
        ...coordinates,
        ...(filters === undefined ? {} : { filters: JSON.stringify(filters) }),
      };
      const { res } = await runHandler(res =>
        offersController.list({ user: viewer, query }, res),
      );
      return {
        statusCode: res.statusCode,
        message: res.body.message,
        features: res.body.features as SearchFeature[],
      };
    }
    const ids = (features: SearchFeature[]) =>
      features.map(feature => feature.properties.id).sort();
    async function memberWith(update: Record<string, unknown> = {}) {
      const [member] = await utils.saveUsers(
        utils.generateUsers(1, { public: true }),
      );
      await User.updateOne({ _id: member._id }, update);
      return member;
    }

    it('names the required coordinates when one is invalid', async () => {
      const { statusCode, message } = await search(owner, undefined, {});

      statusCode.should.equal(400);
      message.should.equal(
        'Invalid or missing coordinate. Required coordinates: southWestLat, southWestLng, northEastLat, northEastLng.',
      );
    });

    it('accepts decimal and exponent notation for coordinates', async () => {
      for (const southWestLat of ['5e0', '1E+0', '5e-10', '+5.5', '.5']) {
        const { statusCode } = await search(owner, undefined, {
          ...validCoords,
          southWestLat,
        });
        statusCode.should.equal(200, southWestLat);
      }
    });

    it('rejects coordinates that are not plain numbers', async () => {
      for (const southWestLat of [
        '12,2',
        '1 2',
        '1x5',
        '1ee5',
        '1e+x',
        '1e999',
        '14.',
        '12foo',
        '3.33.33',
      ]) {
        const { statusCode, message } = await search(owner, undefined, {
          ...validCoords,
          southWestLat,
        });
        statusCode.should.equal(400, southWestLat);
        message.should.startWith(
          'Invalid or missing coordinate.',
          southWestLat,
        );
      }
    });

    it('returns each offer as a GeoJSON point at its fuzzy location', async () => {
      const offer = await createOffer(owner._id, {
        type: 'host',
        status: 'maybe',
        location: [15, 25],
      });
      const stored = required(await Offer.findById(offer._id));
      const [lat, lng] = Array.from(required(stored.locationFuzzy));

      const { features } = await search(owner);

      features.should.deepEqual([
        {
          type: 'Feature',
          properties: {
            id: offer._id.toString(),
            status: 'maybe',
            type: 'host',
            offer: 'host-maybe',
          },
          geometry: { type: 'Point', coordinates: [lng, lat] },
        },
      ]);
    });

    it('lists offers that are available, maybe available or without a status', async () => {
      const yes = await createOffer(owner._id, {
        status: 'yes',
        location: [15, 25],
      });
      const maybe = await createOffer(owner._id, {
        status: 'maybe',
        location: [15.1, 25.1],
      });
      await createOffer(owner._id, { status: 'no', location: [15.2, 25.2] });
      const withoutStatus = await createOffer(owner._id, {
        location: [15.3, 25.3],
      });
      await Offer.updateOne(
        { _id: withoutStatus._id },
        { $unset: { status: 1 } },
      );

      const { features } = await search(owner);

      ids(features).should.deepEqual(idsOf(yes, maybe, withoutStatus));
    });

    it('hides offers of suspended, shadowbanned and non-public members', async () => {
      const visible = await createOffer(stranger._id, { location: [15, 25] });
      for (const [index, update] of [
        { roles: ['user', 'suspended'] },
        { roles: ['user', 'shadowban'] },
        { public: false },
      ].entries()) {
        const hidden = await memberWith(update);
        await createOffer(hidden._id, { location: [16 + index, 26] });
      }

      const { features } = await search(owner);

      ids(features).should.deepEqual(idsOf(visible));
    });

    it('works for a viewer without circle memberships', async () => {
      const offer = await createOffer(stranger._id, { location: [15, 25] });
      const viewer = {
        _id: owner._id,
        public: true,
      } as unknown as UserDocument;

      const { statusCode, features } = await search(viewer);

      statusCode.should.equal(200);
      ids(features).should.deepEqual(idsOf(offer));
    });

    it('ignores empty or malformed filter values', async () => {
      const hostOffer = await createOffer(owner._id, {
        type: 'host',
        location: [15, 25],
      });
      const meetOffer = await createOffer(owner._id, {
        type: 'meet',
        location: [15.1, 25.1],
      });
      const everything = idsOf(hostOffer, meetOffer);

      for (const filters of [
        { tribes: [] },
        { tribes: { a: 1 } },
        { types: [] },
        { types: { 0: 'host', length: 1 } },
        { types: ['unknown'] },
        { languages: [] },
        { languages: { 0: 'fin', length: 1 } },
        { languages: ['not-a-language', 5] },
        { seen: {} },
        { seen: 'abc' },
      ]) {
        await User.updateOne(
          { _id: owner._id },
          { seen: new Date(Date.now() - 60 * 60 * 1000) },
        );
        const { statusCode, features } = await search(owner, filters);
        statusCode.should.equal(200, JSON.stringify(filters));
        ids(features).should.deepEqual(everything, JSON.stringify(filters));
      }
    });

    it('rejects tribe ids that are not strings with the invalid id message', async () => {
      const { statusCode, message } = await search(owner, { tribes: [12] });

      statusCode.should.equal(400);
      message.should.equal('Cannot interpret id.');
    });

    it('filters by language codes, ignoring unknown ones', async () => {
      const first = await memberWith({ languages: ['iso_639_3-aaa'] });
      const second = await memberWith({ languages: ['iso_639_3-aab'] });
      const other = await memberWith({ languages: ['fin'] });
      const firstOffer = await createOffer(first._id, { location: [15, 25] });
      const secondOffer = await createOffer(second._id, {
        location: [15.1, 25.1],
      });
      await createOffer(other._id, { location: [15.2, 25.2] });

      const { features } = await search(owner, {
        languages: ['iso_639_3-aaa', 'iso_639_3-aab', 'not-a-language'],
      });

      ids(features).should.deepEqual(idsOf(firstOffer, secondOffer));
    });

    it('filters by last seen', async () => {
      const recent = await memberWith({ seen: new Date() });
      const old = await memberWith({
        seen: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      });
      const recentOffer = await createOffer(recent._id, { location: [15, 25] });
      await createOffer(old._id, { location: [15.1, 25.1] });

      const { features } = await search(owner, { seen: { days: 30 } });

      ids(features).should.deepEqual(idsOf(recentOffer));
    });

    it('logs the failure when the map query fails', async () => {
      const log = sinon.stub(winston, 'log');
      sinon.stub(Offer, 'aggregate').returns({
        exec: () => Promise.reject(new Error('aggregate failed')),
      } as unknown as ReturnType<typeof Offer.aggregate>);

      const { statusCode } = await search(owner);

      statusCode.should.equal(400);
      sinon.assert.calledWithMatch(
        log,
        'error',
        'Querying for offers caused an error. #g28fb1',
      );
      should((log.firstCall.args as unknown[])[2]).have.property('error');
    });

    it('respects showOnlyInMyCircles on offers', async () => {
      const tribe = await mongoose
        .model('Tribe')
        .create({ label: 'Circle Tribe' });
      const [member, outsider] = await utils.saveUsers(
        utils.generateUsers(2, { public: true }),
      );
      const memberDoc = required(await User.findById(member._id));
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

    it('responds with 404 when the offer is missing a location', async () => {
      const { res } = await runHandler(res =>
        offersController.getOffer(
          { user: owner, offer: { user: owner, location: null } },
          res,
        ),
      );

      res.statusCode.should.equal(404);
    });

    it('returns a sanitized offer', async () => {
      const offer = await createOffer(owner._id, {
        description: '<p>Hosting <script>alert()</script></p>',
        noOfferDescription: '<p>Unavailable <script>alert()</script></p>',
      });
      const offerReq = populatedOffer(
        await Offer.findById(offer._id).populate(
          'user',
          userProfile.userListingProfileFields,
        ),
      );
      const { res } = await runHandler(res =>
        offersController.getOffer({ user: owner, offer: offerReq }, res),
      );
      res.statusCode.should.equal(200);
      res.body.type.should.equal('host');
      res.body.description.should.not.containEql('script');
      res.body.noOfferDescription.should.not.containEql('script');
    });

    it('hides contact details from shadowbanned viewers', async () => {
      const offer = await createOffer(owner._id, {
        description:
          '<p>Write to member@example.org or visit https://example.org/offer.</p>',
        noOfferDescription: '<p>Call (555) 666-7777 instead.</p>',
      });
      const offerReq = populatedOffer(
        await Offer.findById(offer._id).populate(
          'user',
          userProfile.userListingProfileFields,
        ),
      );
      stranger.roles = ['user', 'shadowban'];

      const { res } = await runHandler(res =>
        offersController.getOffer({ user: stranger, offer: offerReq }, res),
      );

      res.statusCode.should.equal(200);
      res.body.description.should.equal('Write to  or visit .');
      res.body.noOfferDescription.should.equal('Call  instead.');
    });

    it('keeps contact details for offer owners and administrative viewers', async () => {
      const offer = await createOffer(owner._id, {
        description: '<p>Visit https://example.org/offer.</p>',
      });
      const offerReq = populatedOffer(
        await Offer.findById(offer._id).populate(
          'user',
          userProfile.userListingProfileFields,
        ),
      );
      stranger.roles = ['user', 'admin', 'shadowban'];

      const ownerResult = await runHandler(res =>
        offersController.getOffer({ user: owner, offer: offerReq }, res),
      );
      const adminResult = await runHandler(res =>
        offersController.getOffer({ user: stranger, offer: offerReq }, res),
      );

      ownerResult.res.body.description.should.containEql(
        'https://example.org/offer',
      );
      adminResult.res.body.description.should.containEql(
        'https://example.org/offer',
      );
    });

    it('returns precise location when the offer user is an owner id', async () => {
      const offer = {
        _id: new mongoose.Types.ObjectId(),
        type: 'host',
        status: 'yes',
        user: owner._id.toString(),
        location: [12, 22],
        locationFuzzy: [10, 20],
        toObject() {
          return {
            _id: this._id,
            type: this.type,
            status: this.status,
            user: this.user,
            location: this.location,
            locationFuzzy: this.locationFuzzy,
          };
        },
      };

      const { res } = await runHandler(res =>
        offersController.getOffer({ user: owner, offer }, res),
      );

      res.statusCode.should.equal(200);
      res.body.location.should.deepEqual([12, 22]);
    });

    it('returns fuzzy location to non-owners', async () => {
      const offer = await createOffer(owner._id, {
        location: [12, 22],
        locationFuzzy: [10, 20],
      });
      const offerReq = populatedOffer(
        await Offer.findById(offer._id).populate(
          'user',
          userProfile.userListingProfileFields,
        ),
      );

      const { res } = await runHandler(res =>
        offersController.getOffer({ user: stranger, offer: offerReq }, res),
      );

      res.statusCode.should.equal(200);
      res.body.location.should.deepEqual([10, 20]);
    });

    it('returns fuzzy location without an authenticated viewer', async () => {
      const offer = await createOffer(owner._id);
      const offerReq = populatedOffer(
        await Offer.findById(offer._id).populate(
          'user',
          userProfile.userListingProfileFields,
        ),
      );

      const { res } = await runHandler(res =>
        offersController.getOffer({ offer: offerReq }, res),
      );

      res.statusCode.should.equal(200);
      res.body.location.should.deepEqual(
        Array.from(required(offerReq.locationFuzzy)),
      );
    });

    it('returns 400 when populating tribe memberships fails', async () => {
      const offer = await createOffer(owner._id);
      const offerReq = populatedOffer(
        await Offer.findById(offer._id).populate(
          'user',
          userProfile.userListingProfileFields,
        ),
      );
      offerReq.user.member = [{ tribe: new mongoose.Types.ObjectId() }];

      const populate = sinon.stub(User, 'populate');
      populate.rejects(new Error('populate failed'));

      const { res } = await runHandler(res =>
        offersController.getOffer({ user: owner, offer: offerReq }, res),
      );
      res.statusCode.should.equal(400);
    });

    it('returns an offer when the owner has no tribe memberships', async () => {
      const offer = await createOffer(owner._id);
      const offerReq = populatedOffer(
        await Offer.findById(offer._id).populate(
          'user',
          userProfile.userListingProfileFields,
        ),
      );
      offerReq.user.member = [];

      const { res } = await runHandler(res =>
        offersController.getOffer({ user: owner, offer: offerReq }, res),
      );
      res.statusCode.should.equal(200);
      res.body.type.should.equal('host');
    });

    it('leaves out descriptions the offer does not have', async () => {
      const offer = {
        _id: new mongoose.Types.ObjectId(),
        type: 'host',
        user: { _id: owner._id },
        location: [12, 22],
        toObject() {
          return {
            _id: this._id,
            type: this.type,
            user: this.user,
            location: this.location,
          };
        },
      };

      const { res } = await runHandler(res =>
        offersController.getOffer({ user: owner, offer }, res),
      );

      res.statusCode.should.equal(200);
      res.body.should.not.have.property('description');
      res.body.should.not.have.property('noOfferDescription');
    });

    it('does not look up tribes for an owner without memberships', async () => {
      const populate = sinon.stub(User, 'populate');
      populate.rejects(new Error('populate failed'));
      const offerOf = (user: Record<string, unknown>) => ({
        _id: new mongoose.Types.ObjectId(),
        type: 'host',
        user,
        location: [12, 22],
        toObject() {
          return {
            _id: this._id,
            type: this.type,
            user: this.user,
            location: this.location,
          };
        },
      });

      for (const user of [{ _id: owner._id }, { _id: owner._id, member: [] }]) {
        const { res } = await runHandler(res =>
          offersController.getOffer({ user: owner, offer: offerOf(user) }, res),
        );
        res.statusCode.should.equal(200);
      }
      populate.called.should.be.false();
    });

    it('logs and answers with the default message when the tribe lookup fails', async () => {
      const log = sinon.stub(winston, 'log');
      sinon.stub(User, 'populate').rejects(new Error('populate failed'));
      const offer = await createOffer(owner._id);
      const offerReq = populatedOffer(
        await Offer.findById(offer._id).populate(
          'user',
          userProfile.userListingProfileFields,
        ),
      );
      offerReq.user.member = [{ tribe: new mongoose.Types.ObjectId() }];

      const { res } = await runHandler(res =>
        offersController.getOffer({ user: owner, offer: offerReq }, res),
      );

      res.statusCode.should.equal(400);
      res.body.message.should.equal(
        'Snap! Something went wrong. If this keeps happening, please contact us.',
      );
      sinon.assert.calledWithMatch(
        log,
        'error',
        'Failed to load offer. #g34gss',
      );
      should((log.firstCall.args as unknown[])[2]).have.property('error');
    });

    it('returns an offer when tribe memberships are undefined', async () => {
      const offer = await createOffer(owner._id);
      const offerReq = populatedOffer(
        await Offer.findById(offer._id).populate(
          'user',
          userProfile.userListingProfileFields,
        ),
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
      const attachedOffer: OfferPayload<
        import('mongoose').Types.ObjectId,
        Date
      > = {
        _id: new mongoose.Types.ObjectId(),
        type: 'host',
        user: owner._id,
        location: [1, 2],
      };
      const { res } = await runHandler(res =>
        offersController.listOffersByUser({ offers: [attachedOffer] }, res),
      );
      res.body.should.deepEqual([attachedOffer]);
    });

    it('returns an empty list when no offers are attached to the request', async () => {
      const { res } = await runHandler(res =>
        offersController.listOffersByUser({}, res),
      );

      res.body.should.deepEqual([]);
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
      const ownerDoc = required(await User.findById(owner._id));
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

    it('lists only the unexpired offers of the user', async () => {
      const current = await createOffer(owner._id, { type: 'host' });
      const expiring = await createOffer(owner._id, {
        type: 'meet',
        validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      const expired = await createOffer(owner._id, { type: 'meet' });
      await Offer.updateOne(
        { _id: expired._id },
        { validUntil: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      );
      await createOffer(stranger._id, { type: 'host' });
      const req = {
        user: required(await User.findById(owner._id)),
        query: {},
      } as ByUserRequest;

      const { nextCalled } = await runHandler((res, next) =>
        offersController.offersByUserId(req, res, next, owner._id.toString()),
      );

      nextCalled.should.be.true();
      required(req.offers)
        .map(offer => String(offer._id))
        .sort()
        .should.deepEqual(idsOf(current, expiring));
    });

    it('narrows the offers to the requested valid types', async () => {
      const host = await createOffer(owner._id, { type: 'host' });
      const meet = await createOffer(owner._id, { type: 'meet' });
      const cases: Array<[string, OfferDocument[]]> = [
        ['host', [host]],
        ['meet,host', [host, meet]],
        ['host,bogus', [host]],
        ['host,host,meet', [host, host]],
        ['bogus,,', [host, meet]],
        ['', [host, meet]],
      ];

      for (const [types, expected] of cases) {
        const req = {
          user: required(await User.findById(owner._id)),
          query: { types },
        } as ByUserRequest;
        await runHandler((res, next) =>
          offersController.offersByUserId(req, res, next, owner._id.toString()),
        );
        required(req.offers)
          .map(offer => String(offer._id))
          .sort()
          .should.deepEqual(
            [...new Set(expected.map(offer => offer._id.toString()))].sort(),
            types,
          );
      }
    });

    it('ignores requested types when schema enum values are unavailable', async () => {
      await createOffer(owner._id, { type: 'host' });
      const ownerDoc = required(await User.findById(owner._id));
      const typePath = Offer.schema.path(
        'type',
      ) as import('mongoose').SchemaType & { enumValues?: string[] };
      const enumValues = typePath.enumValues;
      typePath.enumValues = undefined;

      try {
        const { nextCalled } = await runHandler((res, next) =>
          offersController.offersByUserId(
            { user: ownerDoc, query: { types: 'host' } },
            res,
            next,
            owner._id.toString(),
          ),
        );
        nextCalled.should.be.true();
      } finally {
        typePath.enumValues = enumValues;
      }
    });

    it('ignores invalid requested types', async () => {
      await createOffer(owner._id, { type: 'host' });
      const ownerDoc = required(await User.findById(owner._id));

      const { nextCalled } = await runHandler((res, next) =>
        offersController.offersByUserId(
          { user: ownerDoc, query: { types: 'invalid' } },
          res,
          next,
          owner._id.toString(),
        ),
      );

      nextCalled.should.be.true();
    });

    it('passes lookup errors to next', async () => {
      const findOffers = sinon.stub(
        Offer,
        'find',
      ) as unknown as import('sinon').SinonStub<
        [
          import('mongoose').QueryFilter<OfferRecord>,
          (error: Error | null, offers?: OfferDocument[]) => void,
        ],
        void
      >;
      findOffers.callsFake(() => Promise.reject(new Error('lookup failed')));

      const { nextArg } = await runHandler((res, next) =>
        offersController.offersByUserId(
          { user: owner, query: {} },
          res,
          next,
          owner._id.toString(),
        ),
      );
      if (!(nextArg instanceof Error)) throw new Error('Expected lookup error');
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

    it('responds with 404 when loading an offer errors', async () => {
      const findOfferById = sinon.stub(
        Offer,
        'findById',
      ) as unknown as import('sinon').SinonStub<
        [string],
        {
          populate(): {
            exec(
              callback: (
                error: Error | null,
                offer?: OfferDocument | null,
              ) => void,
            ): void;
          };
        }
      >;
      findOfferById.returns({
        populate: () => ({
          exec: () => Promise.reject(new Error('lookup failed')),
        }),
      });

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

    it('logs the failure when loading an offer errors', async () => {
      const log = sinon.stub(winston, 'log');
      sinon.stub(Offer, 'findById').returns({
        populate: () => ({
          exec: () => Promise.reject(new Error('lookup failed')),
        }),
      } as unknown as ReturnType<typeof Offer.findById>);

      await runHandler((res, next) =>
        offersController.offerById(
          { user: owner },
          res,
          next,
          new mongoose.Types.ObjectId().toString(),
        ),
      );

      sinon.assert.calledWithMatch(
        log,
        'error',
        'Getting offer by id caused an error. #2kg3g3',
      );
      should((log.firstCall.args as unknown[])[2]).have.property('error');
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
      offersController.removeAllByUserId(
        new mongoose.Types.ObjectId(),
        (err?: Error | null) => {
          (err === null || err === undefined).should.be.true();
          done();
        },
      );
    });

    it('removes only the offers of that user', async () => {
      await createOffer(owner._id);
      const kept = await createOffer(stranger._id);

      await new Promise<void>((resolve, reject) =>
        offersController.removeAllByUserId(owner._id, err =>
          err ? reject(err) : resolve(),
        ),
      );

      should(await Offer.findOne({ user: owner._id })).be.null();
      should(await Offer.findById(kept._id)).not.be.null();
    });

    it('passes a failed removal to the callback', async () => {
      sinon.stub(Offer, 'deleteMany').rejects(new Error('remove failed'));

      const error = await new Promise<Error | null | undefined>(resolve =>
        offersController.removeAllByUserId(owner._id, resolve),
      );

      required(error).message.should.equal('remove failed');
    });

    it('does not raise when a failed removal has no callback', async () => {
      sinon.stub(Offer, 'deleteMany').rejects(new Error('remove failed'));
      const unhandled: unknown[] = [];
      const onUnhandled = (reason: unknown) => unhandled.push(reason);
      process.on('unhandledRejection', onUnhandled);

      try {
        offersController.removeAllByUserId(owner._id);
        await new Promise(resolve => setTimeout(resolve, 50));
      } finally {
        process.off('unhandledRejection', onUnhandled);
      }

      unhandled.should.deepEqual([]);
    });

    it('does not require a callback', done => {
      const deleteOffers = sinon.stub(
        Offer,
        'deleteMany',
      ) as unknown as import('sinon').SinonStub<
        [
          import('mongoose').QueryFilter<OfferRecord>,
          (error?: Error | null) => void,
        ],
        void
      >;
      deleteOffers.resolves({ acknowledged: true, deletedCount: 0 });
      offersController.removeAllByUserId(new mongoose.Types.ObjectId());
      sinon.assert.calledOnce(deleteOffers);
      done();
    });
  });
});
