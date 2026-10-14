import type {
  ContactModel,
  ContactRecord,
  TribeModel,
  TribeRecord,
} from '../../../../testutils/server/model-contracts.mts';
import type { Types } from 'mongoose';
/**
 * Unit tests for tribes controller list and middleware branches.
 */
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');

const tribesController: typeof import('./../../server/controllers/tribes.server.controller.mjs') = require('./../../server/controllers/tribes.server.controller.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil') = require('../../../../testutils/server/data.server.testutil');
require('should');

const Tribe = mongoose.model<TribeRecord, TribeModel>('Tribe');
const Contact = mongoose.model<ContactRecord, ContactModel>('Contact');

interface TestTribeView {
  _id: Types.ObjectId;
  slug: string;
  label?: string;
  count?: number;
}

interface DeferredResponse<Body> {
  statusCode: number;
  body: Body;
  headers: Record<string, string>;
  locals: { url: string; paginate: { href(query: { page?: number }): string } };
  status(code: number): this;
  send(body: unknown): this;
  json(body: unknown): this;
  set(key: string, value: string): this;
  links(links: Record<string, string>): this;
  waitForResponse(): Promise<this>;
}

function deferredResponse<
  Body = Record<string, unknown>,
>(): DeferredResponse<Body> {
  let resolveResponse: (response: DeferredResponse<Body>) => void = () => {};
  const promise = new Promise<DeferredResponse<Body>>(resolve => {
    resolveResponse = resolve;
  });
  const res: DeferredResponse<Body> = {
    statusCode: 200,
    body: {} as Body,
    headers: {} as Record<string, string>,
    locals: {
      url: '/api/tribes/',
      paginate: { href: (query: { page?: number }) => `?page=${query.page}` },
    },
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
    set(key: string, value: string) {
      res.headers[key] = value;
      return res;
    },
    links(links: Record<string, string>) {
      res.headers.Link = Object.entries(links)
        .map(([rel, href]) => `<${href}>; rel="${rel}"`)
        .join(', ');
      return res;
    },
    waitForResponse() {
      return promise;
    },
  };
  return res;
}

describe('Tribes controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  describe('listTribes', () => {
    it('returns public tribes sorted by count', async () => {
      await new Tribe({
        label: 'Alpha',
        slug: 'alpha',
        public: true,
        count: 1,
      }).save();
      await new Tribe({
        label: 'Beta',
        slug: 'beta',
        public: true,
        count: 5,
      }).save();

      const res = deferredResponse<TestTribeView[]>();
      tribesController.listTribes(
        { query: {}, protocol: 'https', originalUrl: '/api/tribes' },
        res,
      );
      await res.waitForResponse();
      res.body.should.be.an.Array().with.lengthOf(2);
      res.body[0].slug.should.equal('beta');
    });

    it('omits member-only tribes from anonymous catalogue responses', async () => {
      await new Tribe({
        label: 'Naturists',
        slug: 'naturists',
        public: true,
      }).save();
      await new Tribe({
        label: 'Visible',
        slug: 'visible',
        public: true,
      }).save();

      const res = deferredResponse<TestTribeView[]>();
      tribesController.listTribes(
        { query: {}, protocol: 'https', originalUrl: '/api/tribes' },
        res,
      );
      await res.waitForResponse();
      res.body.map(tribe => tribe.slug).should.deepEqual(['visible']);
    });

    it('includes member-only tribes for authenticated members', async () => {
      await new Tribe({
        label: 'Naturists',
        slug: 'naturists',
        public: true,
      }).save();

      const res = deferredResponse<TestTribeView[]>();
      tribesController.listTribes(
        {
          user: { roles: ['user'] },
          query: {},
          protocol: 'https',
          originalUrl: '/api/tribes',
        },
        res,
      );
      await res.waitForResponse();
      res.body.map(tribe => tribe.slug).should.deepEqual(['naturists']);
    });

    it('sorts tribes alphabetically when requested', async () => {
      await new Tribe({
        label: 'Zulu',
        slug: 'zulu',
        public: true,
        count: 1,
      }).save();
      await new Tribe({
        label: 'Alpha',
        slug: 'alpha-sort',
        public: true,
        count: 5,
      }).save();

      const res = deferredResponse<TestTribeView[]>();
      tribesController.listTribes(
        {
          query: { sortBy: 'alphabetically' },
          protocol: 'https',
          originalUrl: '/api/tribes',
        },
        res,
      );
      await res.waitForResponse();
      res.body[0].slug.should.equal('zulu');
    });

    it('returns 400 when tribe lookup fails', async () => {
      sinon.stub(Tribe, 'find').returns({
        select: () => ({
          sort: () => ({
            limit: () => ({
              skip: () => ({
                exec: (cb: (error: Error) => void) =>
                  cb(new Error('find failed')),
              }),
            }),
          }),
        }),
      } as unknown as ReturnType<typeof Tribe.find>);

      const res = deferredResponse<Record<string, unknown>>();
      tribesController.listTribes(
        { query: {}, protocol: 'https', originalUrl: '/api/tribes' },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns 400 when tribe count fails', async () => {
      sinon.stub(Tribe, 'find').returns({
        select: () => ({
          sort: () => ({
            limit: () => ({
              skip: () => ({
                exec: (
                  cb: (error: Error | null, rows?: TestTribeView[]) => void,
                ) => cb(null, []),
              }),
            }),
          }),
        }),
      } as unknown as ReturnType<typeof Tribe.find>);
      sinon.stub(Tribe, 'countDocuments').callsFake(((
        query: unknown,
        cb: (error: Error) => void,
      ) => {
        void query;
        cb(new Error('count failed'));
      }) as unknown as typeof Tribe.countDocuments);

      const res = deferredResponse();
      tribesController.listTribes(
        { query: {}, protocol: 'https', originalUrl: '/api/tribes' },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });
  });

  describe('getTribe', () => {
    it('returns an empty object when no tribe is attached', async () => {
      const res = deferredResponse<Record<string, unknown>>();
      tribesController.getTribe({}, res);
      await res.waitForResponse();
      res.body.should.deepEqual({});
    });

    it('returns the tribe attached to the request', async () => {
      const tribe = await new Tribe({ label: 'Shown', slug: 'shown' }).save();
      const res = deferredResponse<TestTribeView>();
      tribesController.getTribe({ tribe }, res);
      await res.waitForResponse();
      res.body.slug.should.equal('shown');
    });
  });

  describe('tribeBySlug', () => {
    it('refuses member-only circle details to anonymous visitors', async () => {
      const res = deferredResponse();
      let nextCalled = false;

      tribesController.tribeBySlug(
        {},
        res,
        () => {
          nextCalled = true;
        },
        'naturists',
      );
      await res.waitForResponse();
      res.statusCode.should.equal(403);
      nextCalled.should.be.false();
    });

    it('attaches a member-only circle for an authenticated member', async () => {
      const tribe = await new Tribe({
        label: 'Naturists',
        slug: 'naturists',
        public: true,
      }).save();
      const res = deferredResponse();
      let nextCalled = false;
      const req: { user: { roles: string[] }; tribe?: TestTribeView } = {
        user: { roles: ['user'] },
      };

      await new Promise<void>(resolve => {
        tribesController.tribeBySlug(
          req,
          res,
          () => {
            nextCalled = true;
            resolve();
          },
          'naturists',
        );
      });
      nextCalled.should.be.true();
      req.tribe?._id?.toString().should.equal(tribe._id.toString());
    });

    it('attaches a tribe and calls next', async () => {
      const tribe = await new Tribe({
        label: 'Lookup',
        public: true,
      }).save();
      const res = deferredResponse();
      let nextCalled = false;
      const req: { tribe?: TestTribeView } = {};
      await new Promise<void>(resolve => {
        tribesController.tribeBySlug(
          req,
          res,
          () => {
            nextCalled = true;
            resolve();
          },
          tribe.slug,
        );
      });
      nextCalled.should.be.true();
      req.tribe?._id?.toString().should.equal(tribe._id.toString());
    });

    it('returns 400 when tribe lookup fails', async () => {
      sinon.stub(Tribe, 'findOne').returns({
        exec: (cb: (error: Error) => void) => cb(new Error('find failed')),
      } as unknown as ReturnType<typeof Tribe.findOne>);
      const res = deferredResponse();

      tribesController.tribeBySlug({}, res, () => {}, 'missing-slug');
      const response = await res.waitForResponse();
      response.statusCode.should.equal(400);
    });
  });

  describe('listMembers', () => {
    it('supports legacy viewers without a blocked list', async () => {
      const circleId = new mongoose.Types.ObjectId();
      const res = deferredResponse<{
        contacts: unknown[];
        recommenders: unknown[];
        active: unknown[];
      }>();

      await tribesController.listMembers(
        {
          user: {
            _id: new mongoose.Types.ObjectId(),
            member: [{ tribe: circleId }],
          },
          tribe: { _id: circleId },
        },
        res,
        sinon.stub(),
      );

      res.body.should.eql({ contacts: [], recommenders: [], active: [] });
    });

    it('passes discovery query failures to the error handler', async () => {
      const userId = new mongoose.Types.ObjectId();
      const tribeId = new mongoose.Types.ObjectId();
      const error = new Error('discovery failed');
      sinon.stub(Contact, 'aggregate').returns({
        option: () => ({
          exec: () => Promise.reject(error),
        }),
      } as unknown as ReturnType<typeof Contact.aggregate>);
      const next = sinon.stub();
      const res = deferredResponse();

      await tribesController.listMembers(
        {
          user: { _id: userId, member: [{ tribe: tribeId }], blocked: [] },
          tribe: { _id: tribeId },
        },
        res,
        next,
      );

      next.calledOnceWithExactly(error).should.be.true();
    });
  });

  describe('tribePopulateOptions', () => {
    it('defaults to the public tribe fields', () => {
      tribesController.tribePopulateOptions().should.eql({
        path: 'member.tribe',
        select: tribesController.tribeFields,
        model: 'Tribe',
      });
    });

    it('accepts a reduced field selection', () => {
      const options = tribesController.tribePopulateOptions('slug label');
      options.select.should.equal('slug label');
      options.path.should.equal('member.tribe');
    });
  });
});
