require('should');
const controller: typeof import('../../server/controllers/admin.user-deletion.server.controller.mts') = require('../../server/controllers/admin.user-deletion.server.controller.mts');

interface TestResponse {
  statusCode: number;
  body: unknown;
  status(code: number): this;
  send(body: unknown): this;
}

function response(): TestResponse {
  const result: TestResponse = {
    statusCode: 200,
    body: null,
    status(code) {
      result.statusCode = code;
      return result;
    },
    send(body) {
      result.body = body;
      return result;
    },
  };
  return result;
}

describe('Admin user deletion controller unit tests', () => {
  it('rejects unauthorised direct controller requests', async () => {
    const res = response();
    await controller.deleteMember({}, res);
    res.statusCode.should.equal(403);
  });

  it('rejects an administrator request without a body', async () => {
    const res = response();
    await controller.deleteMember(
      { user: { _id: 'admin-id', roles: ['admin'] } },
      res,
    );
    res.statusCode.should.equal(400);
  });
});
