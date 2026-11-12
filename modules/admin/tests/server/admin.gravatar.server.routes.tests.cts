import type {
  TestExpressApp,
  TestAgent,
} from '../../../../testutils/server/model-contracts.mts';
const mongoose: typeof import('mongoose') = require('mongoose');
const request: typeof import('supertest') = require('supertest');
const assert: typeof import('node:assert').strict =
  require('node:assert').strict;
const sinon: typeof import('sinon') = require('sinon');
const express: import('../../../../testutils/server/model-contracts.mts').TestExpressModule = require('../../../../config/lib/express.mjs');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const controller: typeof import('../../server/controllers/admin.gravatar.server.controller.mts') = require('../../server/controllers/admin.gravatar.server.controller.mts');
const User = mongoose.model('User');

describe('Admin Gravatar usage', () => {
  let app: TestExpressApp;
  let admin: TestAgent;
  let member: TestAgent;
  before(async () => {
    app = await express.init(mongoose.connection);
  });
  beforeEach(async () => {
    const users = utils.generateUsersWithSharedPassword(2);
    users[0].roles = ['user', 'admin'];
    await utils.saveUsersWithCachedPasswords(users);
    admin = request.agent(app);
    member = request.agent(app);
    await admin
      .post('/api/auth/signin')
      .send({ username: users[0].username, password: users[0].password })
      .expect(200);
    await member
      .post('/api/auth/signin')
      .send({ username: users[1].username, password: users[1].password })
      .expect(200);
  });
  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
  });
  it('denies visitors and non-admin roles', async () => {
    await request(app).get('/api/admin/gravatar').expect(403);
    await member.get('/api/admin/gravatar').expect(403);
    for (const role of ['support-team', 'welcome-team']) {
      await User.updateOne(
        { roles: { $ne: 'admin' } },
        { $set: { roles: ['user', role] } },
      );
      await member.get('/api/admin/gravatar').expect(403);
    }
  });
  it('checks Gravatar availability without changing accounts or exposing hashes', async () => {
    const url = '/api/admin/gravatar/photo-check';
    await request(app).get(url).expect(403);
    await request(app).post(url).set('X-Trustroots-Request', '1').expect(403);
    await member.get(url).expect(403);
    await member.post(url).set('X-Trustroots-Request', '1').expect(403);
    const idle = await admin.get(url).expect(200);
    assert.equal(idle.body, null);

    const validHashes = [
      ...['a', 'b', 'c', 'd', 'e'].map(letter => letter.repeat(32)),
      'F'.repeat(64),
      '0'.repeat(32),
    ];
    const hashes = [
      ...validHashes,
      [validHashes[0]],
      `!${validHashes[0]}`,
      `${validHashes[0]}!`,
      'z'.repeat(64),
      undefined,
    ];
    const fixtures = hashes.map((emailHash, index) => {
      const username = `fictional-photo-check-${String(index).padStart(2, '0')}`;
      return {
        username,
        email: `${username}@example.test`,
        avatarSource: 'gravatar',
        ...(emailHash !== undefined && { emailHash }),
      };
    });
    fixtures.push({
      username: 'fictional-photo-check-former',
      email: 'fictional-photo-check-former@example.test',
      avatarSource: 'none',
      emailHash: '1'.repeat(32),
    });
    await User.collection.insertMany(fixtures.map(fixture => ({ ...fixture })));
    const find = sinon.spy(User.collection, 'find');
    const upstream = sinon.stub(globalThis, 'fetch');
    upstream
      .onCall(0)
      .resolves(
        new Response(null, { headers: { 'content-type': 'image/png' } }),
      );
    upstream.onCall(1).resolves(new Response(null, { status: 404 }));
    upstream.onCall(2).resolves(new Response(null, { status: 503 }));
    upstream.onCall(3).rejects(new DOMException('Timed out', 'TimeoutError'));
    upstream
      .onCall(4)
      .resolves(
        new Response(null, { headers: { 'content-type': 'text/html' } }),
      );

    upstream
      .onCall(5)
      .resolves(
        new Response(null, { headers: { 'content-type': 'image/jpeg' } }),
      );
    upstream.onCall(6).resolves(new Response(null));

    const started = await admin
      .post(url)
      .set('X-Trustroots-Request', '1')
      .expect(202);
    assert.equal(started.body.state, 'running');
    const repeated = await admin
      .post(url)
      .set('X-Trustroots-Request', '1')
      .expect(202);
    assert.equal(repeated.body.startedAt, started.body.startedAt);

    let result = await admin.get(url).expect(200);
    for (
      let attempt = 0;
      attempt < 60 && result.body.state === 'running';
      attempt++
    ) {
      await new Promise(resolve => setTimeout(resolve, 50));
      result = await admin.get(url).expect(200);
    }
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.deepEqual(result.body, {
      state: 'complete',
      startedAt: started.body.startedAt,
      finishedAt: result.body.finishedAt,
      counts: { available: 2, unavailable: 1, inconclusive: 9 },
    });
    assert.ok(Number.isFinite(Date.parse(result.body.finishedAt)));
    assert.ok(
      find.calledWith(
        { avatarSource: 'gravatar' },
        sinon.match({ projection: { emailHash: 1, _id: 0 }, batchSize: 50 }),
      ),
    );
    assert.deepEqual(
      upstream.args.map(([target]) => new URL(String(target)).pathname).sort(),
      validHashes.map(hash => `/avatar/${hash}`).sort(),
    );
    for (const [target, options] of upstream.args) {
      const requestUrl = new URL(String(target));
      assert.equal(requestUrl.origin, 'https://gravatar.com');
      assert.equal(requestUrl.searchParams.get('d'), '404');
      assert.equal(options?.method, 'HEAD');
      assert.equal(options?.redirect, 'error');
    }

    const members = await User.collection
      .find({ username: /^fictional-photo-check-/ })
      .project({ _id: 0, username: 1, email: 1, avatarSource: 1, emailHash: 1 })
      .sort({ username: 1 })
      .toArray();
    assert.deepEqual(members, fixtures);
  });
  it('reports an incomplete check when the account query fails', async () => {
    sinon.stub(User, 'find').throws(new Error('Query failed'));
    const url = '/api/admin/gravatar/photo-check';
    await admin.post(url).set('X-Trustroots-Request', '1').expect(202);
    const result = await admin.get(url).expect(200);
    assert.equal(result.body.state, 'failed');
    assert.deepEqual(result.body.counts, {
      available: 0,
      unavailable: 0,
      inconclusive: 0,
    });
  });
  it('returns an empty count and member list', async () => {
    const response = await admin.get('/api/admin/gravatar').expect(200);
    assert.deepEqual(response.body.members, []);
    assert.equal(response.body.accounts, 0);
    assert.equal(response.body.page, 1);
    assert.equal(response.body.hasNextPage, false);
    assert.ok(Number.isFinite(Date.parse(response.body.measuredAt)));
  });
  it('lets only administrators load another member’s private Gravatar', async () => {
    const emailHash = '0123456789abcdef0123456789abcdef';
    const { insertedId } = await User.collection.insertOne({
      username: 'fictional-private-member',
      avatarSource: 'gravatar',
      public: false,
      roles: ['user'],
      emailHash,
    });
    const url = `/api/users/${insertedId}/avatar?size=32`;
    const response = await admin.get(url).expect(302);
    const redirect = new URL(response.headers.location);
    assert.equal(redirect.origin, 'https://gravatar.com');
    assert.equal(redirect.pathname, `/avatar/${emailHash}`);
    assert.equal(redirect.searchParams.get('s'), '32');
    await member.get(url).expect(404);
    await request(app).get(url).expect(403);
  });
  it('counts current selections and returns stable bounded pages without private fields', async () => {
    const oldest = new Date('2026-10-01T08:00:00.000Z');
    const newest = new Date('2026-11-05T18:15:00.000Z');
    const fixtures = Array.from({ length: 51 }, (_, index) => ({
      username: `fictional-${index}`,
      displayName: index === 50 ? 'alpha Member' : 'Fictional Member',
      avatarSource: 'gravatar',
      email: `fictional-${index}@example.test`,
      emailHash: 'private-hash',
      ...(index === 50 ? { seen: newest } : index < 2 ? { seen: oldest } : {}),
    }));
    await User.collection.insertMany(fixtures);
    await User.collection.insertOne({
      username: 'former-gravatar',
      avatarSource: 'none',
    });
    const first = await admin.get('/api/admin/gravatar').expect(200);
    assert.equal(first.body.accounts, 51);
    assert.equal(first.body.members.length, 50);
    assert.equal(first.body.hasNextPage, true);
    assert.deepEqual(Object.keys(first.body.members[0]).sort(), [
      '_id',
      'displayName',
      'seen',
      'username',
    ]);
    assert.equal(first.body.members[0].seen, oldest.toISOString());
    assert.equal(first.body.members[0].username, 'fictional-0');
    const second = await admin.get('/api/admin/gravatar?page=2').expect(200);
    assert.equal(second.body.members.length, 1);
    assert.equal(second.body.members[0].username, 'fictional-50');
    assert.equal(second.body.hasNextPage, false);
    const beyond = await admin.get('/api/admin/gravatar?page=3').expect(200);
    assert.equal(beyond.body.accounts, 51);
    assert.deepEqual(beyond.body.members, []);

    const recent = await admin
      .get('/api/admin/gravatar?sort=seen&direction=descending')
      .expect(200);
    assert.equal(recent.body.accounts, 51);
    assert.deepEqual(
      recent.body.members
        .slice(0, 3)
        .map(({ username }: { username: string }) => username),
      ['fictional-50', 'fictional-0', 'fictional-1'],
    );
    assert.equal(recent.body.members[0].seen, newest.toISOString());
    const early = await admin.get('/api/admin/gravatar?sort=seen').expect(200);
    assert.equal(early.body.members[0].username, 'fictional-0');
    assert.equal(early.body.members[3].seen, undefined);
    const undated = await admin
      .get('/api/admin/gravatar?page=2&sort=seen')
      .expect(200);
    assert.equal(undated.body.members[0].username, 'fictional-49');

    const names = await admin
      .get('/api/admin/gravatar?sort=displayName')
      .expect(200);
    assert.equal(names.body.members[0].username, 'fictional-50');
    const usernames = await admin
      .get('/api/admin/gravatar?sort=username&direction=descending')
      .expect(200);
    assert.equal(usernames.body.members[0].username, 'fictional-9');

    await User.updateOne(
      { username: 'fictional-0' },
      { $set: { avatarSource: 'local' } },
    );
    const updated = await admin.get('/api/admin/gravatar').expect(200);
    assert.equal(updated.body.accounts, 50);
    assert.equal(updated.body.members[0].username, 'fictional-1');
  });
  it('rejects excessive page values', async () => {
    await admin.get('/api/admin/gravatar?page=9007199254740992').expect(400);
    await admin.get('/api/admin/gravatar?page=180143985094820').expect(400);
  });
  it('rejects unsupported sort columns and directions', async () => {
    await admin.get('/api/admin/gravatar?sort=emailHash').expect(400);
    await admin.get('/api/admin/gravatar?sort=seen&sort=username').expect(400);
    await admin
      .get('/api/admin/gravatar?sort=seen&direction=other')
      .expect(400);
  });
  it('returns an error without leaking database details', async () => {
    sinon.stub(User, 'aggregate').throws(new Error('private database details'));
    const response = await admin.get('/api/admin/gravatar').expect(500);
    assert.deepEqual(response.body, {
      message: 'Could not load Gravatar usage.',
    });
  });
  it('rejects invalid page values in direct controller calls', async () => {
    for (const page of [0, -1, 1.5, '0', '-1', '1.5', 'foo', {}, ['1']]) {
      const res = { status: sinon.stub().returnsThis(), send: sinon.stub() };
      await controller.list({ query: { page } }, res);
      sinon.assert.calledWith(res.status, 400);
    }
  });
  it('accepts absent and string pages in direct controller calls', async () => {
    for (const req of [{}, { query: { page: '2' } }]) {
      const res = { status: sinon.stub().returnsThis(), send: sinon.stub() };
      await controller.list(req, res);
      sinon.assert.notCalled(res.status);
      sinon.assert.calledOnce(res.send);
    }
  });
});
