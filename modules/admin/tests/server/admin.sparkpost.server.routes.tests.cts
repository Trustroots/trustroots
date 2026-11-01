const request: typeof import('supertest') = require('supertest');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
let axios: typeof import('axios', {
  with: { 'resolution-mode': 'import' },
}).default;
const express: import('../../../../testutils/server/model-contracts.mts').TestExpressModule = require('../../../../config/lib/express.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');
const diagnostics: typeof import('../../server/services/sparkpost.server.service.mts') = require('../../server/services/sparkpost.server.service.mts');

const now = new Date('2026-10-31T12:00:00.000Z');
const from = '2026-10-28T07:30:00.000Z';
const to = '2026-10-31T11:00:00.000Z';
const metric = {
  ts: '2026-10-30T00:00:00Z',
  count_sent: 4,
  count_delivered: 3,
  count_bounce: 1,
  count_unique_confirmed_opened: 2,
  count_spam_complaint: 0,
};
const event = {
  timestamp: '2026-10-30T12:00:00Z',
  type: 'delivery',
  campaign_id: 'confirm-email',
  recipient_domain: 'example.test',
  rcpt_to: 'fictional@example.test',
  subject: 'Private text',
};

describe('SparkPost admin diagnostics', () => {
  let app: import('../../../../testutils/server/model-contracts.mts').TestExpressApp;
  const savedKey = process.env.SPARKPOST_API_KEY;
  const savedBase = process.env.SPARKPOST_API_BASE;
  let get: import('sinon').SinonStub;
  before(async () => {
    axios = (await import('axios')).default;
    app = await express.init(mongoose.connection);
  });
  beforeEach(() => {
    process.env.SPARKPOST_API_KEY = 'fictional-api-key';
    delete process.env.SPARKPOST_API_BASE;
    get = sinon.stub(axios, 'get');
    get.resolves({ data: { results: [metric] } });
  });
  afterEach(async () => {
    sinon.restore();
    if (savedKey === undefined) delete process.env.SPARKPOST_API_KEY;
    else process.env.SPARKPOST_API_KEY = savedKey;
    if (savedBase === undefined) delete process.env.SPARKPOST_API_BASE;
    else process.env.SPARKPOST_API_BASE = savedBase;
    await mongoose.connection.collection('agendaJobs').deleteMany({});
    await utils.clearDatabase();
  });

  it('rejects guests and non-admin roles before calling the provider', async () => {
    for (const action of [
      'overview',
      'events',
      'preview',
      'accounts',
      'recovery',
    ])
      await request(app)
        .get('/api/admin/sparkpost/' + action)
        .expect(403);
    for (const role of ['user', 'support-team', 'welcome-team']) {
      const user = utils.generateUsers(1)[0];
      user.roles = ['user', role];
      await utils.saveUsers([user]);
      const agent = request.agent(app);
      await agent.post('/api/auth/signin').send(user).expect(200);
      for (const action of [
        'overview',
        'events',
        'preview',
        'accounts',
        'recovery',
      ])
        await agent.get('/api/admin/sparkpost/' + action).expect(403);
      await utils.clearDatabase();
    }
    assert.equal(get.callCount, 0);
  });

  it('serves admin overview and input errors without caching or exposing provider errors', async () => {
    const user = utils.generateUsers(1)[0];
    user.roles = ['user', 'admin'];
    await utils.saveUsers([user]);
    const agent = request.agent(app);
    await agent.post('/api/auth/signin').send(user).expect(200);
    const response = await agent
      .get('/api/admin/sparkpost/overview?days=7')
      .expect(200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.body.rows.length, 7);
    await agent.get('/api/admin/sparkpost/overview?days=200').expect(400);
    await agent.get('/api/admin/sparkpost/events?date=invalid').expect(400);
    await agent.get('/api/admin/sparkpost/preview').expect(400);
    await agent.get('/api/admin/sparkpost/accounts').expect(400);
    await agent
      .get('/api/admin/sparkpost/recovery?date=2026-10-30')
      .expect(200);
    await agent
      .post('/api/admin/sparkpost/recovery')
      .send({ date: '2026-10-30', keys: [] })
      .expect(400);
    await agent.get('/api/admin/sparkpost/unknown').expect(404);
    const preview = await agent
      .get('/api/admin/sparkpost/preview')
      .query({ from, to })
      .expect(200);
    assert.equal(preview.body.jobsInspected, 0);
    get.resolves({ data: { results: [] } });
    const date = new Date().toISOString().slice(0, 10);
    await agent.get('/api/admin/sparkpost/events').query({ date }).expect(200);
    get.rejects(new Error('fictional-api-key must remain private'));
    const failure = await agent
      .get('/api/admin/sparkpost/events')
      .query({ date })
      .expect(503);
    assert.ok(!JSON.stringify(failure.body).includes('fictional-api-key'));
  });

  it('validates periods and exact bounded UTC windows', () => {
    assert.equal(diagnostics.period(undefined), 30);
    for (const days of ['7', '30', '90'])
      assert.equal(diagnostics.period(days), Number(days));
    for (const value of [7, [], '', '1', '7x'])
      assert.throws(() => diagnostics.period(value));
    assert.deepEqual(diagnostics.windowDates(from, to, now), {
      from: new Date(from),
      to: new Date(to),
    });
    assert.deepEqual(
      diagnostics.windowDates(from, '2026-11-01T00:00:00.000Z', now),
      { from: new Date(from), to: now },
    );
    for (const [a, b] of [
      [null, to],
      ['bad', to],
      ['2026-02-30T00:00:00.000Z', to],
      [to, from],
      [from, from],
      ['2026-11-01T00:00:00.000Z', '2026-11-02T00:00:00.000Z'],
      ['2026-01-01T00:00:00.000Z', to],
    ]) {
      assert.throws(() => diagnostics.windowDates(a, b, now));
    }
  });

  it('combines UTC application counts and provider metrics, with unknown days distinct from zero', async () => {
    await mongoose.connection
      .collection('users')
      .insertOne({ created: new Date('2026-10-30T08:00:00Z') });
    await mongoose.connection
      .collection('messages')
      .insertOne({ created: new Date('2026-10-30T09:00:00Z') });
    const result = await diagnostics.overview(7, now);
    assert.equal(result.provider, 'ready');
    assert.equal(result.rows[0].sent, null);
    assert.deepEqual(result.rows[1], {
      date: '2026-10-30',
      signups: 1,
      messages: 1,
      sent: 4,
      delivered: 3,
      bounced: 1,
      opens: 2,
      complaints: 0,
    });
    assert.equal(result.rows[2].messages, 0);
    assert.equal(result.rows[2].signups, 0);
    assert.equal(
      get.firstCall.args[1].headers.Authorization,
      'fictional-api-key',
    );
    assert.equal(get.firstCall.args[1].maxRedirects, 0);
    assert.equal(get.firstCall.args[1].params.precision, 'day');
    assert.match(get.firstCall.args[0], /^https:\/\/api.eu.sparkpost.com\//);
    process.env.SPARKPOST_API_BASE = 'https://api.sparkpost.com/';
    await diagnostics.overview(7, now);
    assert.match(get.lastCall.args[0], /^https:\/\/api.sparkpost.com\//);
    process.env.SPARKPOST_API_BASE = 'https://untrusted.example.test';
    assert.equal((await diagnostics.overview(7, now)).provider, 'unavailable');
    delete process.env.SPARKPOST_API_KEY;
    assert.equal((await diagnostics.overview(7, now)).provider, 'disabled');
  });

  it('keeps application data when provider responses fail validation or requests fail', async () => {
    get.resolves({ data: { results: [{ ts: 'bad' }] } });
    assert.equal((await diagnostics.overview(7, now)).provider, 'unavailable');
    get.rejects(new Error('upstream failure'));
    assert.equal((await diagnostics.overview(7, now)).provider, 'unavailable');
  });

  it('paginates every event type and matches current recipient accounts', async () => {
    await mongoose.connection.collection('users').insertOne({
      email: 'fictional@example.test',
      username: 'matched-member',
      created: new Date(from),
      public: false,
    });
    get.resolves({
      data: {
        results: [event],
        links: { next: 'https://untrusted.example.test/path?cursor=second' },
      },
    });
    const result = await diagnostics.events('2026-10-30', now);
    assert.equal(result.nextCursor, 'second');
    assert.equal(result.events[0].recipient, 'fictional@example.test');
    assert.equal(result.events[0].subject, 'Private text');
    assert.equal(result.events[0].account?.username, 'matched-member');
    assert.equal(get.firstCall.args[1].params.events, undefined);
    get.resolves({ data: { results: [{ timestamp: '123', type: 'open' }] } });
    const next = await diagnostics.events('2026-10-30', now, 'second');
    assert.equal(next.events[0].type, 'open');
    assert.equal(get.lastCall.args[1].params.cursor, 'second');
    assert.equal(next.nextCursor, undefined);
    get.resolves({ data: { results: [event], links: { next: '/no-cursor' } } });
    assert.equal((await diagnostics.events('2026-10-30', now)).capped, true);
    get.resolves({
      data: { results: [event], links: { next: '?cursor=same' } },
    });
    assert.equal(
      (await diagnostics.events('2026-10-30', now, 'same')).capped,
      true,
    );
    await assert.rejects(diagnostics.events('2026-10-30', now, []));
  });

  it('rejects invalid, future and expired event days and missing API credentials', async () => {
    for (const day of [null, 'bad', '2026-02-30', '2026-10-01', '2026-11-01'])
      await assert.rejects(diagnostics.events(day, now), /Choose/);
    delete process.env.SPARKPOST_API_KEY;
    await assert.rejects(
      diagnostics.events('2026-10-30', now),
      /not configured/,
    );
  });

  it('previews successful jobs and pending signups without changing data or exposing messages', async () => {
    const collection = mongoose.connection.collection('agendaJobs');
    const finished = new Date('2026-10-29T00:00:00Z');
    await collection.insertMany([
      {
        name: 'send email',
        lastFinishedAt: finished,
        data: {
          headers: {
            'X-MSYS-API': JSON.stringify({ campaign_id: 'confirm-email' }),
          },
          text: 'Secret body',
        },
      },
      {
        name: 'send email',
        lastFinishedAt: finished,
        data: { headers: { 'X-MSYS-API': '{}' } },
      },
      { name: 'send email', lastFinishedAt: finished },
      { name: 'send email', lastFinishedAt: finished, failedAt: finished },
      { name: 'other job', lastFinishedAt: finished },
      { name: 'send email', lastFinishedAt: new Date(to) },
    ]);
    await mongoose.connection.collection('users').insertMany([
      {
        email: 'pending@example.test',
        username: 'pending-member',
        created: finished,
        public: false,
        roles: ['user'],
      },
      {
        email: 'suspended@example.test',
        username: 'suspended-member',
        created: finished,
        public: false,
        roles: ['suspended'],
      },
      {
        email: 'hidden@example.test',
        username: 'hidden-member',
        created: finished,
        public: false,
        roles: ['shadowban'],
      },
      {
        email: 'confirmed@example.test',
        username: 'confirmed-member',
        created: finished,
        public: true,
        roles: ['user'],
      },
      {
        email: 'later@example.test',
        username: 'later-member',
        created: new Date(to),
        public: false,
        roles: ['user'],
      },
    ]);
    const before = await collection.find({}).toArray();
    const result = await diagnostics.preview(from, to, now);
    assert.equal(result.awaitingConfirmation, 1);
    assert.equal(result.jobsInspected, 3);
    assert.equal(result.capped, false);
    assert.deepEqual(result.campaigns, [
      { campaign: 'Unknown', count: 2 },
      { campaign: 'confirm-email', count: 1 },
    ]);
    assert.deepEqual(await collection.find({}).toArray(), before);
    assert.equal(get.callCount, 0);
  });

  it('caps the job preview and sorts equal campaign counts consistently', async () => {
    await mongoose.connection.collection('agendaJobs').insertMany(
      Array.from({ length: 1001 }, (_, i) => ({
        name: 'send email',
        lastFinishedAt: new Date(from),
        data: {
          headers: {
            'X-MSYS-API': JSON.stringify({
              campaign_id: i % 2 ? 'beta' : 'alpha',
            }),
          },
        },
      })),
    );
    const result = await diagnostics.preview(from, to, now);
    assert.equal(result.capped, true);
    assert.equal(result.jobsInspected, 1000);
    assert.deepEqual(result.campaigns, [
      { campaign: 'alpha', count: 500 },
      { campaign: 'beta', count: 500 },
    ]);
  });
});
