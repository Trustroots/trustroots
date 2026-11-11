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

    it('includes member-only tribes for signed-in viewers', async () => {
      await new Tribe({
        label: 'Naturists',
        slug: 'naturists',
        public: true,
      }).save();

      const res = deferredResponse<TestTribeView[]>();
      tribesController.listTribes(
        {
          query: {},
          protocol: 'https',
          originalUrl: '/api/tribes',
          user: { roles: ['user'] },
        },
        res,
      );
      await res.waitForResponse();
      res.body.map(tribe => tribe.slug).should.deepEqual(['naturists']);
    });

    describe('paging', () => {
      const saveTribes = (count: number) =>
        Promise.all(
          Array.from({ length: count }, (_, index) =>
            new Tribe({
              label: `Paged ${index}`,
              slug: `paged-${index}`,
              public: true,
              count: index,
            }).save(),
          ),
        );

      it('takes a multi-digit limit from the request URL', async () => {
        await saveTribes(13);
        const res = deferredResponse<TestTribeView[]>();
        tribesController.listTribes(
          {
            query: { limit: '1' },
            protocol: 'https',
            originalUrl: '/api/tribes?limit=12',
          },
          res,
        );
        await res.waitForResponse();
        res.body.should.have.length(12);
      });

      it('falls back to the parsed query limit without a URL limit', async () => {
        await saveTribes(3);
        const res = deferredResponse<TestTribeView[]>();
        tribesController.listTribes(
          {
            query: { limit: '2' },
            protocol: 'https',
            originalUrl: '/api/tribes',
          },
          res,
        );
        await res.waitForResponse();
        res.body.should.have.length(2);
      });

      it('falls back to the query limit when the request has no URL', async () => {
        await saveTribes(3);
        const res = deferredResponse<TestTribeView[]>();
        tribesController.listTribes(
          { query: { limit: '2' }, protocol: 'https' },
          res,
        );
        await res.waitForResponse();
        res.body.should.have.length(2);
      });

      it('links to the next page, relative to the site, while pages remain', async () => {
        await saveTribes(3);
        const res = deferredResponse<TestTribeView[]>();
        tribesController.listTribes(
          {
            query: { limit: '2', page: 1 },
            protocol: 'https',
            originalUrl: '/api/tribes?limit=2',
          },
          res,
        );
        await res.waitForResponse();
        res.headers.Link.should.equal('<?page=2>; rel="next"');
      });

      it('sets no next link on the last page', async () => {
        await saveTribes(3);
        const res = deferredResponse<TestTribeView[]>();
        tribesController.listTribes(
          {
            query: { limit: '2', page: 2 },
            protocol: 'https',
            originalUrl: '/api/tribes?limit=2&page=2',
          },
          res,
        );
        await res.waitForResponse();
        res.body.should.have.length(1);
        res.headers.should.not.have.property('Link');
      });
    });

    it('returns 400 when tribe lookup fails', async () => {
      sinon.stub(Tribe, 'find').returns({
        select: () => ({
          sort: () => ({
            limit: () => ({
              skip: () => ({
                exec: () => Promise.reject(new Error('find failed')),
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
  });

  describe('getTribe', () => {
    it('returns an empty object when no tribe is attached', async () => {
      const res = deferredResponse<Record<string, unknown>>();
      tribesController.getTribe({}, res);
      await res.waitForResponse();
      res.body.should.deepEqual({});
    });
  });

  describe('updateCount', () => {
    it('updates the cached member count and returns the updated tribe', async () => {
      const tribe = await new Tribe({
        label: 'Counted circle',
        count: 1,
      }).save();
      await new Promise<void>((resolve, reject) => {
        tribesController.updateCount(
          tribe._id.toString(),
          2,
          true,
          (error, updatedTribe) => {
            if (error) {
              reject(error);
              return;
            }
            if (!updatedTribe) {
              reject(new Error('Expected the updated tribe document'));
              return;
            }
            updatedTribe.count!.should.equal(3);
            resolve();
          },
        );
      });
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

    it('returns 400 when tribe lookup fails', async () => {
      sinon.stub(Tribe, 'findOne').returns({
        exec: () => Promise.reject(new Error('find failed')),
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

    it('refuses viewers without any circle memberships', async () => {
      const res = deferredResponse();
      let status = 0;
      res.status = (code: number) => {
        status = code;
        res.statusCode = code;
        return res;
      };
      const next = sinon.stub();

      await tribesController.listMembers(
        {
          user: { _id: new mongoose.Types.ObjectId() },
          tribe: { _id: new mongoose.Types.ObjectId() },
        },
        res,
        next,
      );

      status.should.equal(403);
      next.called.should.be.false();
    });

    it('bounds every discovery query with a one second time limit', async () => {
      const circleId = new mongoose.Types.ObjectId();
      const options: unknown[] = [];
      const originalOption = mongoose.Aggregate.prototype.option;
      sinon.stub(mongoose.Aggregate.prototype, 'option').callsFake(function (
        this: unknown,
        value: unknown,
      ) {
        options.push(value);
        return originalOption.call(this, value as never);
      });
      const res = deferredResponse();

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

      options.should.deepEqual([{ maxTimeMS: 1000 }, { maxTimeMS: 1000 }]);
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

  it('uses viewer-scoped connection queries and classifies exact activity boundaries', async () => {
    const assert: typeof import('node:assert/strict') = require('node:assert/strict');
    const User = mongoose.model('User');
    const Experience = mongoose.model('Experience');
    const day = 86_400_000;
    const now = new Date('2026-01-31T12:00:00Z');
    sinon.useFakeTimers({ now, toFake: ['Date'] });
    const self = new mongoose.Types.ObjectId();
    const ids = Array.from({ length: 4 }, () => new mongoose.Types.ObjectId());
    const contacts = sinon.spy(Contact, 'distinct');
    const references = sinon.spy(Experience, 'distinct');
    const users = sinon.spy(User, 'find');
    const exec = sinon.stub(mongoose.Query.prototype, 'exec');
    exec.onCall(0).resolves([ids[0]]);
    exec.onCall(1).resolves([ids[1]]);
    exec.onCall(2).resolves(ids.slice(2));
    exec.onCall(3).resolves(
      ids.map((_id, index) => ({
        _id,
        seen: new Date(now.getTime() - [1, 7, 30, 31][index] * day),
      })),
    );
    exec
      .onCall(4)
      .resolves([{ _id: ids[0], username: 'host', displayName: 'Host' }]);
    exec.onCall(5).resolves([]);
    const response = deferredResponse<{
      recent: { activity: string }[];
      hosts: unknown[];
    }>();
    const next = sinon.stub();
    await tribesController.listConnections(
      { user: { _id: self } },
      response,
      next,
    );
    assert.equal(next.callCount, 0);
    assert.deepEqual(contacts.firstCall.args, [
      'userTo',
      { userFrom: self, confirmed: true },
    ]);
    assert.deepEqual(contacts.secondCall.args, [
      'userFrom',
      { userTo: self, confirmed: true },
    ]);
    assert.deepEqual(references.firstCall.args, [
      'userFrom',
      { userTo: self, public: true, recommend: 'yes' },
    ]);
    const recent = users.firstCall.returnValue;
    assert.deepEqual(recent.getFilter().$and?.[1], { _id: { $in: ids } });
    assert.deepEqual(recent.getFilter().seen, {
      $gte: new Date(now.getTime() - 30 * day),
    });
    assert.deepEqual(recent.getOptions().sort, { seen: -1, _id: 1 });
    assert.equal(recent.projection()?.seen, 1);
    assert.deepEqual(users.secondCall.returnValue.projection(), {
      username: 1,
      displayName: 1,
      'member.tribe': 1,
    });
    assert.deepEqual(
      response.body.recent.map(row => row.activity),
      ['week', 'month', 'month', 'older'],
    );
    assert.deepEqual(response.body.hosts, []);
  });

  it('passes connection discovery failures to the error handler', async () => {
    const error = new Error('connection discovery failed');
    sinon.stub(Contact, 'distinct').throws(error);
    const next = sinon.stub();
    await tribesController.listConnections(
      { user: { _id: new mongoose.Types.ObjectId() } },
      deferredResponse(),
      next,
    );
    next.calledOnceWithExactly(error).should.be.true();
  });

  describe('tribePopulateOptions', () => {
    it('defaults to the public tribe fields', () => {
      tribesController.tribePopulateOptions().should.eql({
        path: 'member.tribe',
        select: tribesController.tribeFields,
        model: 'Tribe',
      });
    });
  });
});
