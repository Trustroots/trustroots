const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const assert: typeof import('node:assert').strict =
  require('node:assert').strict;
const controller: typeof import('../../server/controllers/admin.username-changes.server.controller.mts') = require('../../server/controllers/admin.username-changes.server.controller.mts');
const User = mongoose.model('User');

interface MockResponse {
  statusCode: number;
  body: unknown;
  status(code: number): this;
  send(body: unknown): this;
}

function mockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: undefined,
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

describe('Admin username changes controller', () => {
  afterEach(() => sinon.restore());

  it('accepts numeric and numeric-string page values', async () => {
    const aggregate = { exec: sinon.stub().resolves([]) };
    sinon
      .stub(User, 'aggregate')
      .returns(aggregate as unknown as ReturnType<typeof User.aggregate>);
    const res = mockResponse();

    await controller.list({ query: { page: 2, range: 'all' } }, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual((res.body as { page: number }).page, 2);
    sinon.assert.calledOnce(User.aggregate as sinon.SinonStub);
    sinon.assert.calledOnce(aggregate.exec);

    const stringPageResponse = mockResponse();
    await controller.list(
      { query: { page: '3', range: 'all' } },
      stringPageResponse,
    );
    assert.strictEqual(stringPageResponse.statusCode, 200);
    assert.strictEqual((stringPageResponse.body as { page: number }).page, 3);
    sinon.assert.calledTwice(aggregate.exec);
  });

  it('rejects malformed, zero, unsafe, and non-numeric page values', async () => {
    for (const page of [null, 'not-a-page', '0', '9007199254740992', 0, 1.5]) {
      const res = mockResponse();

      await controller.list({ query: { page } }, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(
        (res.body as { message: string }).message,
        'Invalid username change filters.',
      );
    }
  });

  it('returns an error response when the aggregation fails', async () => {
    const aggregate = {
      exec: sinon.stub().rejects(new Error('aggregate failed')),
    };
    sinon
      .stub(User, 'aggregate')
      .returns(aggregate as unknown as ReturnType<typeof User.aggregate>);
    const res = mockResponse();

    await controller.list({ query: {} }, res);

    assert.strictEqual(res.statusCode, 400);
    const body = res.body as { message: string };
    assert.strictEqual(
      body.message,
      'Snap! Something went wrong. If this keeps happening, please contact us.',
    );
    sinon.assert.calledOnce(aggregate.exec);
  });
});
