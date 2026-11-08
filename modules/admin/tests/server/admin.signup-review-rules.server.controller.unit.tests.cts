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
        body: { revision: 0, rules: [], confirmEmpty: true },
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
        body: { revision: 0, rules: [], confirmEmpty: true },
      },
      failedResponse,
    );
    failedResponse.statusCode.should.equal(500);
  });
});

describe('Admin signup review rules controller with stored rules', () => {
  const assert: typeof import('node:assert').strict =
    require('node:assert').strict;
  const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
  const AuditLog = mongoose.model<{ body: Record<string, unknown> }>(
    'AuditLog',
  );
  const admin = {
    _id: String(new mongoose.Types.ObjectId()),
    roles: ['admin'],
  };
  const rules = [{ kind: 'keyword', value: 'fictional phrase' }];
  const changed = {
    statusCode: 409,
    body: { message: 'Rules changed. Reload before saving again.' },
  };
  const saveFailed = {
    statusCode: 500,
    body: { message: 'Could not save signup review rules.' },
  };

  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
  });

  async function call(
    action: 'list' | 'save',
    body?: Record<string, unknown>,
    user: { _id: string; roles: string[] } | null = admin,
  ) {
    const res = response();
    await controller[action]({ user, body } as never, res);
    return {
      statusCode: res.statusCode,
      body: JSON.parse(JSON.stringify(res.body)),
    };
  }

  it('explains refusals and read failures', async () => {
    for (const action of ['list', 'save'] as const) {
      assert.deepEqual(await call(action, undefined, null), {
        statusCode: 403,
        body: { message: 'Administrator access required.' },
      });
    }
    sinon.stub(SignupReviewRules, 'findById').returns({
      lean: () => Promise.reject(new Error('storage unavailable')),
    } as unknown as ReturnType<typeof SignupReviewRules.findById>);
    assert.deepEqual(await call('list'), {
      statusCode: 500,
      body: { message: 'Could not load signup review rules.' },
    });
  });

  it('requires a non-negative integer revision and confirmation to clear', async () => {
    for (const revision of ['0', -1]) {
      assert.deepEqual(await call('save', { revision, rules }), {
        statusCode: 400,
        body: {
          message:
            'Provide a current revision and at most 500 unique, valid keyword, email or domain rules.',
        },
      });
    }
    assert.deepEqual(await call('save', { revision: 0, rules: [] }), {
      statusCode: 400,
      body: {
        message: 'Confirm that you intend to disable all signup review rules.',
      },
    });
    assert.equal(await AuditLog.countDocuments(), 0);
  });

  it('saves and audits rules, then refuses a stale revision', async () => {
    assert.deepEqual(await call('save', { revision: 0, rules }), {
      statusCode: 200,
      body: { revision: 1, rules },
    });
    const audit = (await AuditLog.findOne().lean())!;
    assert.deepEqual(audit.body, { revision: 0, rules, confirmEmpty: false });
    assert.deepEqual(await call('save', { revision: 0, rules }), changed);
  });

  it('does not recreate rules removed after they were read', async () => {
    sinon.stub(SignupReviewRules, 'findById').returns({
      lean: () => Promise.resolve({ _id: 'signup-review', revision: 1, rules }),
    } as unknown as ReturnType<typeof SignupReviewRules.findById>);
    assert.deepEqual(await call('save', { revision: 1, rules }), changed);
    sinon.restore();
    assert.equal(await SignupReviewRules.countDocuments(), 0);
  });

  it('reports only duplicate-key update failures as conflicts', async () => {
    for (const [failure, expected] of [
      [Object.assign(new Error('duplicate'), { code: 11000 }), changed],
      [Object.assign(new Error('validation'), { code: 121 }), saveFailed],
      [{ code: 121 }, saveFailed],
      ['unavailable', saveFailed],
      [null, saveFailed],
    ] as const) {
      sinon
        .stub(SignupReviewRules, 'findOneAndUpdate')
        .callsFake(() => Promise.reject(failure) as never);
      assert.deepEqual(await call('save', { revision: 0, rules }), expected);
      sinon.restore();
    }
  });
});
