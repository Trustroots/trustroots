const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const assert: typeof import('node:assert').strict =
  require('node:assert').strict;
require('should');

if (!mongoose.models.User) {
  require('../../../users/server/models/user.server.model.mjs');
}
if (!mongoose.models.AuditLog) {
  require('../../server/models/audit-log.server.model.mts');
}

const networkConnections: typeof import('../../server/controllers/admin.network-connections.server.controller.mts').default = require('../../server/controllers/admin.network-connections.server.controller.mts');
const User = mongoose.model('User');
const AuditLog = mongoose.model('AuditLog');

type ControllerResponse = {
  statusCode: number;
  body: unknown;
  status(code: number): ControllerResponse;
  send(body: unknown): ControllerResponse;
  waitForResponse(): Promise<ControllerResponse>;
};

type ObjectId = import('mongoose').Types.ObjectId;

type StaffRequest = {
  query: { page?: unknown; network?: unknown; identifier?: unknown };
  params: { memberId?: string };
  route: { path: string };
  user: { _id: ObjectId };
};

type Member = Record<string, unknown> & {
  _id: ObjectId;
  username: string;
  displayName: string;
};

function mockResponse(): ControllerResponse {
  let resolveResponse!: (response: ControllerResponse) => void;
  const promise = new Promise<ControllerResponse>(resolve => {
    resolveResponse = resolve;
  });
  const res: ControllerResponse = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(body) {
      res.body = body;
      resolveResponse(res);
      return res;
    },
    waitForResponse: () => promise,
  };
  return res;
}

function request(
  query: StaffRequest['query'] = {},
  memberId?: string,
): StaffRequest {
  return {
    query,
    params: memberId ? { memberId } : {},
    route: { path: '/api/admin/network-connections' },
    user: { _id: new mongoose.Types.ObjectId() },
  };
}

function stubAggregate(result: unknown[], reject = false): void {
  const query = {
    exec: reject
      ? sinon.stub().rejects(new Error('aggregate failed'))
      : sinon.stub().resolves(result),
  };
  sinon
    .stub(User, 'aggregate')
    .returns(query as unknown as ReturnType<typeof User.aggregate>);
}

function stubFind(result: Member[], reject = false) {
  const query = {
    select: sinon.stub(),
    sort: sinon.stub(),
    skip: sinon.stub(),
    limit: sinon.stub(),
    lean: sinon.stub(),
  };
  query.select.returns(query);
  query.sort.returns(query);
  query.skip.returns(query);
  query.limit.returns(query);
  query.lean.returns(
    reject ? Promise.reject(new Error('find failed')) : Promise.resolve(result),
  );
  const find = sinon
    .stub(User, 'find')
    .returns(query as unknown as ReturnType<typeof User.find>);
  return { find, query };
}

function stubAuditSave(reject = false) {
  const save = sinon.stub(AuditLog.prototype, 'save');
  if (reject) save.rejects(new Error('audit failed'));
  else save.resolves({} as never);
  return save;
}

async function callHistory(req: StaffRequest): Promise<ControllerResponse> {
  const res = mockResponse();
  await networkConnections.history(req, res);
  return res.waitForResponse();
}

async function callSearch(req: StaffRequest): Promise<ControllerResponse> {
  const res = mockResponse();
  await networkConnections.search(req, res);
  return res.waitForResponse();
}

describe('Admin network connections controller unit tests', () => {
  afterEach(() => sinon.restore());

  describe('history', () => {
    it('rejects invalid page and member identifiers before querying', async () => {
      for (const req of [
        request({ page: '0' }, new mongoose.Types.ObjectId().toString()),
        request({}, 'not-an-id'),
        request({}, undefined),
      ]) {
        const response = await callHistory(req);
        response.statusCode.should.equal(400);
      }
    });

    it('returns current connections and a 50-entry page with a next page', async () => {
      const memberId = new mongoose.Types.ObjectId();
      const history = Array.from({ length: 51 }, (_, index) => ({
        network: 'github',
        oldIdentifier: `old-${index}`,
        newIdentifier: `new-${index}`,
        changedAt: new Date(index),
        initial: false,
      }));
      const member = {
        _id: memberId,
        extSitesCouchers: 'couchers-id',
        additionalProvidersData: { github: { login: 'current-name' } },
        history,
      };
      const aggregate = sinon.stub(User, 'aggregate').returns({
        exec: sinon.stub().resolves([member]),
      } as unknown as ReturnType<typeof User.aggregate>);
      const save = stubAuditSave();

      const response = await callHistory(
        request({ page: 1 }, memberId.toString()),
      );
      response.statusCode.should.equal(200);
      const body = response.body as {
        current: Array<{ network: string; identifier: string }>;
        history: unknown[];
        page: number;
        hasNextPage: boolean;
      };
      body.page.should.equal(1);
      body.history.length.should.equal(50);
      body.hasNextPage.should.equal(true);
      body.current.should.containEql({
        network: 'couchers',
        identifier: 'couchers-id',
      });
      body.current.should.containEql({
        network: 'github',
        identifier: 'current-name',
      });
      aggregate.calledOnce.should.equal(true);
      save.calledOnce.should.equal(true);
    });

    it('returns 404 when the member does not exist', async () => {
      stubAggregate([]);
      const save = stubAuditSave();
      const response = await callHistory(
        request({}, new mongoose.Types.ObjectId().toString()),
      );
      response.statusCode.should.equal(404);
      save.called.should.equal(false);
    });

    it('returns an empty final page and reports aggregate failures', async () => {
      const id = new mongoose.Types.ObjectId();
      stubAggregate([{ history: [] }]);
      stubAuditSave();
      const response = await callHistory(request({ page: 2 }, id.toString()));
      response.statusCode.should.equal(200);
      (response.body as { history: unknown[] }).history.length.should.equal(0);
      (response.body as { hasNextPage: boolean }).hasNextPage.should.equal(
        false,
      );

      sinon.restore();
      stubAggregate([], true);
      const failed = await callHistory(request({}, id.toString()));
      failed.statusCode.should.equal(500);
    });

    it('fails closed when audit persistence fails', async () => {
      const id = new mongoose.Types.ObjectId();
      stubAggregate([{ history: [] }]);
      stubAuditSave(true);
      const response = await callHistory(request({}, id.toString()));
      response.statusCode.should.equal(500);
    });
  });

  describe('search', () => {
    it('rejects invalid pages, networks, and identifiers', async () => {
      for (const query of [
        { page: '0', network: 'github', identifier: 'someone' },
        { network: 'unknown', identifier: 'someone' },
        { network: 'github', identifier: '' },
        { network: 'github', identifier: 123 },
        { network: 'github', identifier: 'x'.repeat(2049) },
      ]) {
        const response = await callSearch(request(query));
        response.statusCode.should.equal(400);
      }
    });

    it('parses a valid profile URL, keeps duplicate members, and marks historical matches', async () => {
      const members: Member[] = [
        {
          _id: new mongoose.Types.ObjectId(),
          username: 'member-one',
          displayName: 'Member One',
          additionalProvidersData: { github: { login: 'Example' } },
        },
        {
          _id: new mongoose.Types.ObjectId(),
          username: 'member-two',
          displayName: 'Member Two',
          additionalProvidersData: { github: { login: 'Different' } },
        },
      ];
      const { find, query } = stubFind(members);
      const save = stubAuditSave();

      const response = await callSearch(
        request({
          network: 'github',
          identifier: 'https://github.com/Example?tab=repositories',
        }),
      );
      response.statusCode.should.equal(200);
      const body = response.body as {
        members: Array<{
          username: string;
          identifier: string;
          current: boolean;
        }>;
        hasNextPage: boolean;
      };
      body.members.length.should.equal(2);
      body.members[0]!.identifier.should.equal('example');
      body.members[0]!.current.should.equal(true);
      body.members[1]!.current.should.equal(false);
      body.hasNextPage.should.equal(false);
      find.calledOnce.should.equal(true);
      assert.deepStrictEqual((find.firstCall.args as unknown[])[0], {
        connectionSearchKeys: 'github:example',
      });
      query.skip.calledOnceWithExactly(0).should.equal(true);
      query.limit.calledOnceWithExactly(51).should.equal(true);
      save.calledOnce.should.equal(true);
      const auditDocument = (save.thisValues as unknown[])[0] as {
        query: Record<string, unknown>;
        params: Record<string, unknown>;
        body: Record<string, unknown>;
      };
      auditDocument.query.should.have.property('network', 'github');
      auditDocument.query.should.not.have.property('identifier');
      auditDocument.body.should.be.empty();
    });

    it('returns 51-result pagination and reports search failures', async () => {
      const members: Member[] = Array.from({ length: 51 }, (_, index) => ({
        _id: new mongoose.Types.ObjectId(),
        username: `member-${index}`,
        displayName: `Member ${index}`,
      }));
      stubFind(members);
      stubAuditSave();
      const response = await callSearch(
        request({ network: 'github', identifier: 'member', page: 2 }),
      );
      response.statusCode.should.equal(200);
      const body = response.body as {
        members: unknown[];
        page: number;
        hasNextPage: boolean;
      };
      body.members.length.should.equal(50);
      body.page.should.equal(2);
      body.hasNextPage.should.equal(true);

      sinon.restore();
      stubFind([], true);
      const failed = await callSearch(
        request({ network: 'github', identifier: 'member' }),
      );
      failed.statusCode.should.equal(500);
    });

    it('fails closed when search audit persistence fails', async () => {
      stubFind([]);
      stubAuditSave(true);
      const response = await callSearch(
        request({ network: 'github', identifier: 'member' }),
      );
      response.statusCode.should.equal(500);
    });
  });
});
