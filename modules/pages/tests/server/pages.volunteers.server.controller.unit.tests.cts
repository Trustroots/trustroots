/**
 * Unit tests for the volunteers controller.
 */
const mongoose: typeof import('mongoose') = require('mongoose');
const lodash: typeof import('lodash') = require('lodash');
require('./../../../users/server/models/user.server.model.mjs');
const sinon: typeof import('sinon') = require('sinon');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const should: typeof import('should') = require('should');
void should;

type Volunteer = Pick<
  import('../../../../testutils/server/model-contracts.mts').UserRecord,
  'firstName' | 'username' | 'roles'
> & { _id: string; lastName?: string; email?: string };
type QueryCallback = (error: Error | null, users?: Volunteer[]) => void;
type ExecHandler = (callback: QueryCallback) => void;
type FakeQuery = {
  select: import('sinon').SinonStub<[field: string], FakeQuery>;
  sort: import('sinon').SinonStub<[field: string], FakeQuery>;
  limit: import('sinon').SinonStub<[count: number], FakeQuery>;
  exec: import('sinon').SinonStub<[callback: QueryCallback], void>;
  then: Promise<Volunteer[] | undefined>['then'];
};
type MockResponse = {
  statusCode: number;
  body: Record<string, unknown> | null;
  status(code: number): MockResponse;
  send(body: Record<string, unknown>): MockResponse;
  waitForResponse(): Promise<MockResponse>;
};

function mockResponse(): MockResponse {
  let resolveResponse!: (response: MockResponse) => void;
  const promise = new Promise<MockResponse>(resolve => {
    resolveResponse = resolve;
  });
  const res: MockResponse = {
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

async function loadController(execHandler: ExecHandler) {
  const exec: FakeQuery['exec'] = sinon
    .stub<[callback: QueryCallback], void>()
    .callsFake(execHandler);
  const User = mongoose.model<
    Pick<
      import('../../../../testutils/server/model-contracts.mts').UserRecord,
      'firstName' | 'username' | 'roles'
    > & { _id: string }
  >('User');
  const select = sinon.stub<[field: string], FakeQuery>();
  const sort = sinon.stub<[field: string], FakeQuery>();
  const limit = sinon.stub<[count: number], FakeQuery>();
  const query: FakeQuery = {
    select,
    sort,
    limit,
    exec,
    then(onFulfilled, onRejected) {
      return new Promise<Volunteer[] | undefined>((resolve, reject) => {
        execHandler((error, users) => (error ? reject(error) : resolve(users)));
      }).then(onFulfilled, onRejected);
    },
  };
  select.withArgs('username firstName roles').returns(query);
  sort.withArgs('firstName username').returns(query);
  limit.withArgs(500).returns(query);
  const find = sinon.stub(User, 'find') as unknown as import('sinon').SinonStub<
    [filter: Record<string, unknown>],
    FakeQuery
  >;
  find.returns(query);
  const shuffle = sinon.stub(lodash, 'shuffle').callsFake(users => users);
  void shuffle;
  const controller =
    await import('../../server/controllers/pages.volunteers.server.controller.mts');

  return { controller, exec, find, limit, select, sort };
}

describe('Volunteers controller unit tests', () => {
  afterEach(() => sinon.restore());
  it('queries volunteer and alumni roles with bounded selected results', async () => {
    const harness = await loadController(callback => callback(null, []));
    const res = mockResponse();

    harness.controller.list(
      {},
      res as unknown as Parameters<typeof harness.controller.list>[1],
    );
    await res.waitForResponse();

    harness.find
      .calledOnceWithExactly({
        roles: { $in: ['volunteer', 'volunteer-alumni'] },
      })
      .should.be.true();
    harness.select
      .calledOnceWithExactly('username firstName roles')
      .should.be.true();
    harness.sort.calledOnceWithExactly('firstName username').should.be.true();
    harness.limit.calledOnceWithExactly(500).should.be.true();
  });

  it('returns 400 when the database lookup fails', async () => {
    const harness = await loadController(callback =>
      callback(new Error('lookup failed')),
    );
    const res = mockResponse();

    harness.controller.list(
      {},
      res as unknown as Parameters<typeof harness.controller.list>[1],
    );
    const response = await res.waitForResponse();

    response.statusCode.should.equal(400);
    assert.ok(response.body && typeof response.body.message === 'string');
    (response.body!.message as string).should.startWith(
      'Snap! Something went wrong.',
    );
  });

  it('returns volunteers and alumni grouped by role with only public fields', async () => {
    const users: Volunteer[] = [
      {
        _id: 'volunteer-id',
        firstName: 'Active',
        lastName: 'Hidden',
        roles: ['user', 'volunteer'],
        username: 'activevol',
      },
      {
        _id: 'alumni-id',
        firstName: 'Former',
        email: 'hidden@example.com',
        roles: ['user', 'volunteer-alumni'],
        username: 'formervol',
      },
      {
        _id: 'both-id',
        firstName: 'Both',
        roles: ['volunteer', 'volunteer-alumni'],
        username: 'bothvol',
      },
    ];
    const harness = await loadController(callback => callback(null, users));
    const res = mockResponse();

    harness.controller.list(
      {},
      res as unknown as Parameters<typeof harness.controller.list>[1],
    );
    const response = await res.waitForResponse();

    response.statusCode.should.equal(200);
    const body = response.body as unknown as {
      volunteers: Array<{ _id: string; firstName: string; username: string }>;
      alumni: Array<{ _id: string; firstName: string; username: string }>;
    };
    body.volunteers.should.deepEqual([
      { _id: 'volunteer-id', firstName: 'Active', username: 'activevol' },
      { _id: 'both-id', firstName: 'Both', username: 'bothvol' },
    ]);
    body.alumni.should.deepEqual([
      { _id: 'alumni-id', firstName: 'Former', username: 'formervol' },
      { _id: 'both-id', firstName: 'Both', username: 'bothvol' },
    ]);
  });
});
