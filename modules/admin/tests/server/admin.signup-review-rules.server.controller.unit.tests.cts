const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
require('should');
const controller: typeof import('../../server/controllers/admin.signup-review-rules.server.controller.mts') = require('../../server/controllers/admin.signup-review-rules.server.controller.mts');

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

const SignupReviewRules = mongoose.model('SignupReviewRules');

describe('Admin signup review rules controller unit tests', () => {
  afterEach(() => sinon.restore());

  it('rejects direct unauthorised requests to list and save rules', async () => {
    const listResponse = response();
    await controller.list({}, listResponse);
    listResponse.statusCode.should.equal(403);
    const saveResponse = response();
    await controller.save({}, saveResponse);
    saveResponse.statusCode.should.equal(403);
  });

  it('reports a read failure', async () => {
    sinon.stub(SignupReviewRules, 'findById').returns({
      lean: () => Promise.reject(new Error('storage unavailable')),
    } as unknown as ReturnType<typeof SignupReviewRules.findById>);
    const res = response();
    await controller.list({ user: { _id: 'admin', roles: ['admin'] } }, res);
    res.statusCode.should.equal(500);
  });

  it('rejects a direct save request that has no body', async () => {
    const res = response();
    await controller.save({ user: { _id: 'admin', roles: ['admin'] } }, res);
    res.statusCode.should.equal(400);
  });

  it('handles unique-key races and unexpected update failures', async () => {
    const AuditLog = mongoose.model('AuditLog');
    sinon.stub(AuditLog.prototype, 'save').resolves({});
    const duplicate = Object.assign(new Error('duplicate'), { code: 11000 });
    sinon.stub(SignupReviewRules, 'findOneAndUpdate').rejects(duplicate);
    const duplicateResponse = response();
    await controller.save(
      {
        user: { _id: 'admin', roles: ['admin'] },
        body: { revision: 0, rules: [] },
      },
      duplicateResponse,
    );
    duplicateResponse.statusCode.should.equal(409);

    sinon.restore();
    sinon.stub(AuditLog.prototype, 'save').resolves({});
    sinon
      .stub(SignupReviewRules, 'findOneAndUpdate')
      .rejects(new Error('database unavailable'));
    const failedResponse = response();
    await controller.save(
      {
        user: { _id: 'admin', roles: ['admin'] },
        body: { revision: 0, rules: [] },
      },
      failedResponse,
    );
    failedResponse.statusCode.should.equal(500);
  });
});
