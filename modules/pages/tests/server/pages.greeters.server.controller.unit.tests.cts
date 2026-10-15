const mongoose: typeof import('mongoose') = require('mongoose');
require('./../../../users/server/models/user.server.model.mjs');
const sinon: typeof import('sinon') = require('sinon');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
require('should');

type Greeter = {
  _id: string;
  username: string;
  displayName: string;
  email: string;
};
type QueryCallback = (error: Error | null, users?: Greeter[]) => void;
type ExecHandler = (callback: QueryCallback) => void;
type FakeQuery = {
  select: import('sinon').SinonStub<[field: string], FakeQuery>;
  sort: import('sinon').SinonStub<[field: string], FakeQuery>;
  limit: import('sinon').SinonStub<[count: number], FakeQuery>;
  exec: import('sinon').SinonStub<[callback: QueryCallback], void>;
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
  const response = new Promise<MockResponse>(resolve => {
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
    waitForResponse: () => response,
  };
  return res;
}

async function loadController(execHandler: ExecHandler) {
  const exec: FakeQuery['exec'] = sinon
    .stub<[callback: QueryCallback], void>()
    .callsFake(execHandler);
  const User =
    mongoose.model<
      import('../../../../testutils/server/model-contracts.mts').UserRecord
    >('User');
  const select = sinon.stub<[field: string], FakeQuery>();
  const sort = sinon.stub<[field: string], FakeQuery>();
  const limit = sinon.stub<[count: number], FakeQuery>();
  const query: FakeQuery = { select, sort, limit, exec };
  select.withArgs('username displayName').returns(query);
  sort.withArgs('displayName username').returns(query);
  limit.withArgs(500).returns(query);
  const find = sinon.stub(User, 'find') as unknown as import('sinon').SinonStub<
    [filter: Record<string, unknown>],
    FakeQuery
  >;
  find.returns(query);
  const controller =
    await import('../../server/controllers/pages.greeters.server.controller.mts');
  return { controller, exec, find, limit, select, sort };
}

describe('Greeters controller unit tests', () => {
  afterEach(() => sinon.restore());

  it('selects current public greeters and returns only roster fields', async () => {
    const users = [
      {
        _id: 'greeter-id',
        username: 'river',
        displayName: 'River Host',
        email: 'private@example.test',
      },
    ];
    const harness = await loadController(callback => callback(null, users));
    const res = mockResponse();

    harness.controller.list(
      {},
      res as unknown as Parameters<typeof harness.controller.list>[1],
    );
    const response = await res.waitForResponse();

    harness.find
      .calledOnceWithExactly({
        public: true,
        roles: { $all: ['welcome-team'], $nin: ['suspended', 'shadowban'] },
      })
      .should.be.true();
    harness.select
      .calledOnceWithExactly('username displayName')
      .should.be.true();
    harness.sort.calledOnceWithExactly('displayName username').should.be.true();
    harness.limit.calledOnceWithExactly(500).should.be.true();
    response.body!.should.deepEqual({
      greeters: [
        {
          _id: 'greeter-id',
          username: 'river',
          displayName: 'River Host',
        },
      ],
    });
  });

  it('returns a server error when the database lookup fails', async () => {
    const harness = await loadController(callback =>
      callback(new Error('lookup failed')),
    );
    const res = mockResponse();

    harness.controller.list(
      {},
      res as unknown as Parameters<typeof harness.controller.list>[1],
    );
    const response = await res.waitForResponse();

    response.statusCode.should.equal(500);
    assert.ok(response.body && typeof response.body.message === 'string');
    response.body.message.should.startWith('Snap! Something went wrong.');
  });
});
