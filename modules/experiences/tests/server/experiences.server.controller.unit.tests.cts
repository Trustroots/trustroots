import type {
  ContactModel,
  ContactRecord,
  ExperienceModel,
  ExperienceRecord,
} from '../../../../testutils/server/model-contracts.mts';
import type { Types } from 'mongoose';
/**
 * Unit tests for experiences controller branches not covered by route tests.
 */
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');

require('./../../../contacts/server/models/contacts.server.model.mjs');
require('./../../server/models/experiences.server.model.mjs');
const experiencesController: typeof import('./../../server/controllers/experiences.server.controller.mjs') = require('./../../server/controllers/experiences.server.controller.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil') = require('../../../../testutils/server/data.server.testutil');
require('should');

const Experience = mongoose.model<ExperienceRecord, ExperienceModel>(
  'Experience',
);
const Contact = mongoose.model<ContactRecord, ContactModel>('Contact');

interface DeferredResponse<Body> {
  statusCode: number;
  body: Body;
  status(code: number): this;
  send(body: unknown): this;
  json(body: unknown): this;
  waitForResponse(): Promise<this>;
}

function deferredResponse<Body = null>(): DeferredResponse<Body> {
  let resolveResponse: (response: DeferredResponse<Body>) => void = () => {};
  const promise = new Promise<DeferredResponse<Body>>(resolve => {
    resolveResponse = resolve;
  });
  const res: DeferredResponse<Body> = {
    statusCode: 200,
    body: null as Body,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    send(body: unknown) {
      res.body = body as Body;
      resolveResponse(res);
      return res;
    },
    json(body: unknown) {
      res.body = body as Body;
      resolveResponse(res);
      return res;
    },
    waitForResponse() {
      return promise;
    },
  };
  return res;
}

describe('Experiences controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  describe('create validation', () => {
    it('rejects missing interactions without unexpected interaction fields', async () => {
      const [viewer, target] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(2, { public: true }),
      );
      const res = deferredResponse<{
        details: { interactions: { any: string }; fields?: unknown };
      }>();

      await experiencesController.create(
        {
          user: viewer,
          body: {
            userTo: target._id.toString(),
            recommend: 'yes',
          },
          query: {},
          params: {},
        },
        res,
        () => {},
      );

      res.statusCode.should.equal(400);
      res.body.details.interactions.any.should.equal('missing');
      res.body.details.should.not.have.property('fields');
    });
  });

  describe('getCount', () => {
    it('returns the experience count for another user', async () => {
      const [viewer, target] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(2, { public: true }),
      );
      await new Experience({
        userFrom: viewer._id,
        userTo: target._id,
        public: true,
        recommend: 'yes',
        interactions: { met: true },
      }).save();

      const res = deferredResponse<{ count: number }>();
      experiencesController.getCount(
        {
          user: viewer,
          body: {},
          query: { userTo: target._id.toString() },
          params: {},
        },
        res,
        () => {},
      );
      await res.waitForResponse();

      res.statusCode.should.equal(200);
      res.body.count.should.equal(1);
      res.body.should.not.have.property('hasPending');
    });

    it('includes pending experiences for the authenticated user', async () => {
      const [user, author] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(2, { public: true }),
      );
      await new Experience({
        userFrom: author._id,
        userTo: user._id,
        public: false,
        recommend: 'yes',
        interactions: { met: true },
      }).save();

      const res = deferredResponse<{ count: number; hasPending: boolean }>();
      experiencesController.getCount(
        { user, body: {}, query: { userTo: user._id.toString() }, params: {} },
        res,
        () => {},
      );
      await res.waitForResponse();

      res.body.count.should.equal(1);
      res.body.hasPending.should.be.true();
    });

    it('passes unexpected errors to next', async () => {
      const [user] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(1, { public: true }),
      );
      sinon.stub(Experience, 'aggregate').returns({
        exec: () => {
          throw new Error('count failed');
        },
      } as unknown as ReturnType<typeof Experience.aggregate>);

      const nextArg = await new Promise<Error>((resolve, reject) => {
        experiencesController.getCount(
          {
            user,
            body: {},
            query: { userTo: user._id.toString() },
            params: {},
          },
          deferredResponse(),
          (err: unknown) => {
            if (err instanceof Error) resolve(err);
            else reject(new Error('Expected an Error from next'));
          },
        );
      });

      nextArg.should.be.Error();
      nextArg.message.should.equal('count failed');
    });
  });

  describe('getSuggestion', () => {
    it('treats a missing blocked list as empty', async () => {
      const selfId = new mongoose.Types.ObjectId();
      sinon.stub(Experience, 'distinct').returns({
        exec: () => Promise.resolve([]),
      } as unknown as ReturnType<typeof Experience.distinct>);
      const aggregate = sinon.stub(Contact, 'aggregate').returns({
        exec: () => Promise.resolve([]),
      } as unknown as ReturnType<typeof Contact.aggregate>);
      const res = deferredResponse();

      await experiencesController.getSuggestion(
        { user: { _id: selfId }, body: {}, query: {}, params: {} },
        res,
        () => {},
      );

      (res.body === null).should.be.true();
      (
        aggregate.firstCall.args[0][2] as {
          $match: { userId: { $nin: Types.ObjectId[] } };
        }
      ).$match.userId.$nin.should.deepEqual([selfId]);
    });

    it('passes database errors to next', async () => {
      const [user] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(1, { public: true }),
      );
      const error = new Error('suggestion failed');
      sinon.stub(Experience, 'distinct').returns({
        exec: () => Promise.reject(error),
      } as unknown as ReturnType<typeof Experience.distinct>);

      const nextArg = await new Promise<Error>((resolve, reject) => {
        experiencesController.getSuggestion(
          { user, body: {}, query: {}, params: {} },
          deferredResponse(),
          (err: unknown) => {
            if (err instanceof Error) resolve(err);
            else reject(new Error('Expected an Error from next'));
          },
        );
      });

      nextArg.should.equal(error);
    });
  });
});
