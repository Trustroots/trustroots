const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const controller: typeof import('../../server/controllers/admin.sparkpost.server.controller.mts') = require('../../server/controllers/admin.sparkpost.server.controller.mts');
const config = require('../../../../config/config.mts');

type MockResponse = {
  headers: Record<string, string>;
  statusCode: number;
  body: unknown;
  set(name: string, value: string): MockResponse;
  status(code: number): MockResponse;
  json(body: unknown): MockResponse;
};

function mockResponse(): MockResponse {
  const res: MockResponse = {
    headers: {},
    statusCode: 200,
    body: undefined,
    set(name, value) {
      res.headers[name] = value;
      return res;
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

function diagnostics(action: string, query: Record<string, unknown> = {}) {
  const res = mockResponse();
  return controller
    .diagnostics({ params: { action }, query } as never, res as never)
    .then(() => res);
}

function recover(request: Record<string, unknown>) {
  const res = mockResponse();
  return controller.recover(request as never, res as never).then(() => res);
}

describe('SparkPost admin controller', () => {
  const saved = {
    key: process.env.SPARKPOST_API_KEY,
    node: process.env.NODE_ENV,
    tier: process.env.TRUSTROOTS_DEPLOYMENT_TIER,
    mode: process.env.TRUSTROOTS_MAIL_MODE,
  };
  let original: { domain: string; options: unknown };
  beforeEach(() => {
    original = { domain: config.domain, options: config.mailer.options };
  });
  afterEach(async () => {
    sinon.restore();
    config.domain = original.domain;
    config.mailer.options = original.options;
    for (const [name, value] of Object.entries({
      SPARKPOST_API_KEY: saved.key,
      NODE_ENV: saved.node,
      TRUSTROOTS_DEPLOYMENT_TIER: saved.tier,
      TRUSTROOTS_MAIL_MODE: saved.mode,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await utils.clearDatabase();
  });

  it('lists recovery accounts for a window', async () => {
    const [user] = await utils.saveUsersWithCachedPasswords(
      utils.generateUsersWithSharedPassword(1).map(fixture => ({
        ...fixture,
        public: false,
      })),
    );
    const now = Date.now();
    const res = await diagnostics('accounts', {
      from: new Date(now - 86400000).toISOString(),
      to: new Date(now + 60000).toISOString(),
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    const body = res.body as {
      page: number;
      more: boolean;
      candidates: Array<{ username: string }>;
    };
    assert.equal(body.page, 1);
    assert.equal(body.more, false);
    assert.deepEqual(
      body.candidates.map(candidate => candidate.username),
      [user.username],
    );
  });

  it('answers unknown diagnostics with a not-found message', async () => {
    const res = await diagnostics('unknown');
    assert.equal(res.statusCode, 404);
    assert.deepEqual(res.body, { message: 'Unknown email diagnostic.' });
  });

  it('returns input errors and hides provider failures', async () => {
    const invalid = await diagnostics('overview', { days: '200' });
    assert.equal(invalid.statusCode, 400);
    assert.deepEqual(invalid.body, {
      message: 'Choose a period of 7, 30 or 90 days.',
    });
    delete process.env.SPARKPOST_API_KEY;
    const unavailable = await diagnostics('events', {
      date: new Date().toISOString().slice(0, 10),
    });
    assert.equal(unavailable.statusCode, 503);
    assert.deepEqual(unavailable.body, {
      message:
        'Email diagnostics are unavailable. Check the database and SparkPost configuration.',
    });
  });

  it('refuses recovery without an administrator, uncached', async () => {
    for (const request of [
      {},
      { user: { _id: new mongoose.Types.ObjectId(), roles: ['user'] } },
    ]) {
      const res = await recover(request);
      assert.equal(res.statusCode, 403);
      assert.equal(res.headers['Cache-Control'], 'no-store');
      assert.deepEqual(res.body, { message: 'Administrator access required.' });
    }
  });

  it('returns recovery input errors and hides storage failures', async () => {
    const user = { _id: new mongoose.Types.ObjectId(), roles: ['admin'] };
    const invalid = await recover({
      user,
      body: { date: '2026-10-30', keys: [] },
    });
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.headers['Cache-Control'], 'no-store');
    assert.deepEqual(invalid.body, {
      message: 'Select between 1 and 50 distinct recovery emails.',
    });
    process.env.NODE_ENV = 'production';
    process.env.TRUSTROOTS_DEPLOYMENT_TIER = 'production';
    process.env.TRUSTROOTS_MAIL_MODE = 'live';
    config.domain = 'www.trustroots.org';
    config.mailer.options = { host: 'smtp.example.test' };
    sinon
      .stub(mongoose.model('User'), 'findOne')
      .rejects(new Error('Fictional private failure'));
    const failed = await recover({
      user,
      body: { date: '2026-10-30', keys: ['signup:000000000000000000000000'] },
    });
    assert.equal(failed.statusCode, 503);
    assert.deepEqual(failed.body, {
      message:
        'Recovery could not be completed. Inspect results before retrying.',
    });
  });
});
