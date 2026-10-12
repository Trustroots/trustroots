const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const request = require('supertest');
const sinon = require('sinon');
const express = require('../../../../config/lib/express.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');

const User = mongoose.model('User');
const AccountActivity = mongoose.model('AccountActivity');

describe('Member account activity', function () {
  let app;
  let recordActivity;

  before(async function () {
    app = await express.init(mongoose.connection);
    ({ recordActivity } = await import(
      '../../server/services/account-activity.server.service.mjs'
    ));
  });

  afterEach(utils.clearDatabase);
  afterEach(() => sinon.restore());

  async function createMember(username) {
    const credentials = {
      username,
      password: 'ExamplePassword123!',
    };
    const user = await new User({
      ...credentials,
      firstName: 'Example',
      lastName: 'Member',
      email: `${username}@example.test`,
      provider: 'local',
      roles: ['user'],
      public: true,
    }).save();
    return { credentials, user };
  }

  async function signedInAgent(credentials) {
    const agent = request.agent(app);
    await agent.post('/api/auth/signin').send(credentials).expect(200);
    await agent.get('/api/auth/sessions').expect(200);
    return agent;
  }

  it('returns only the signed-in member’s redacted activity with no-store headers', async function () {
    const memberA = await createMember('activity-member-a');
    const memberB = await createMember('activity-member-b');
    const agentA = await signedInAgent(memberA.credentials);
    const agentB = await signedInAgent(memberB.credentials);
    assert.equal(
      await AccountActivity.countDocuments({
        user: memberA.user._id,
        eventType: 'session_created',
      }),
      1,
    );
    await AccountActivity.deleteMany({});
    await AccountActivity.create([
      {
        _id: 'activity-a',
        user: memberA.user._id,
        eventType: 'password_changed',
        createdAt: new Date(),
      },
      {
        _id: 'activity-expired',
        user: memberA.user._id,
        eventType: 'password_reset',
        createdAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
      },
      {
        _id: 'activity-b',
        user: memberB.user._id,
        eventType: 'email_changed',
        createdAt: new Date(),
      },
    ]);

    const response = await agentA.get('/api/users/activity').expect(200);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.match(response.headers.vary, /Cookie/);
    assert.deepEqual(
      response.body.events.map(event => event.eventType),
      ['password_changed'],
    );
    assert.deepEqual(Object.keys(response.body.events[0]).sort(), [
      'createdAt',
      'eventType',
    ]);
    assert.equal(JSON.stringify(response.body).includes('activity-a'), false);
    assert.equal(
      response.body.events.some(event => event.eventType === 'password_reset'),
      false,
    );
    assert.equal(
      JSON.stringify(response.body).includes(memberB.user.id),
      false,
    );

    const otherResponse = await agentB.get('/api/users/activity').expect(200);
    assert.deepEqual(
      otherResponse.body.events.map(event => event.eventType),
      ['email_changed'],
    );
    const anonymous = await request(app).get('/api/users/activity').expect(403);
    assert.equal(anonymous.headers['cache-control'], 'no-store');
    await agentA.get('/api/users/activity?limit=0').expect(400);
  });

  it('uses opaque stable cursors and bounds each page at 50 entries', async function () {
    const member = await createMember('activity-pages');
    const agent = await signedInAgent(member.credentials);
    await AccountActivity.deleteMany({});
    const createdAt = Date.now() - 10000;
    await AccountActivity.create(
      [1, 2, 3].map(index => ({
        _id: `page-${index}`,
        user: member.user._id,
        eventType: 'password_changed',
        createdAt: new Date(createdAt + index * 1000),
      })),
    );

    const firstPage = await agent
      .get('/api/users/activity?limit=2')
      .expect(200);
    assert.equal(firstPage.body.events.length, 2);
    assert.equal(typeof firstPage.body.nextCursor, 'string');
    assert.equal(firstPage.body.nextCursor.includes('page-'), false);
    const secondPage = await agent
      .get('/api/users/activity')
      .query({ limit: 2, cursor: firstPage.body.nextCursor })
      .expect(200);
    assert.equal(secondPage.body.events.length, 1);
    assert.equal(secondPage.body.nextCursor, null);
    assert.equal(
      new Set(
        [...firstPage.body.events, ...secondPage.body.events].map(event =>
          new Date(event.createdAt).getTime(),
        ),
      ).size,
      3,
    );
    const boundedPage = await agent
      .get('/api/users/activity?limit=51')
      .expect(200);
    assert.ok(boundedPage.body.events.length <= 50);
    await agent.get('/api/users/activity?cursor=invalid').expect(400);
    const invalidCursor = Buffer.from(
      JSON.stringify({ createdAt: 'not-a-date', id: 'page-id' }),
    ).toString('base64url');
    await agent
      .get('/api/users/activity')
      .query({ cursor: invalidCursor })
      .expect(400);
    const oversizedIdentifier = Buffer.from(
      JSON.stringify({
        createdAt: new Date().toISOString(),
        id: 'x'.repeat(129),
      }),
    ).toString('base64url');
    await agent
      .get('/api/users/activity')
      .query({ cursor: oversizedIdentifier })
      .expect(400);
    await agent
      .get(`/api/users/activity?cursor=${'x'.repeat(513)}`)
      .expect(400);
    await agent.get('/api/users/activity?limit=abc').expect(400);
  });

  it('forwards storage errors to the application error handler', async function () {
    const member = await createMember('activity-storage-error');
    const agent = await signedInAgent(member.credentials);
    const query = {
      sort: () => query,
      limit: () => query,
      select: () => query,
      lean: () => query,
      exec: async () => {
        throw new Error('temporary storage failure');
      },
    };
    sinon.stub(AccountActivity, 'find').returns(query);

    await agent.get('/api/users/activity').expect(500);
  });

  it('retries storage with the same event identifier and creates retention indexes', async function () {
    let attempts = 0;
    const identifiers = [];
    sinon.stub(AccountActivity, 'updateOne').callsFake(async filter => {
      attempts += 1;
      identifiers.push(filter._id);
      if (attempts < 3) throw new Error('temporary storage failure');
      return { upsertedCount: 1 };
    });
    const recorded = await recordActivity({
      userId: new mongoose.Types.ObjectId(),
      eventType: 'password_changed',
      eventId: 'stable-retry-event',
    });
    assert.equal(recorded, true);
    assert.equal(attempts, 3);
    assert.deepEqual(identifiers, [
      'stable-retry-event',
      'stable-retry-event',
      'stable-retry-event',
    ]);

    const indexes = AccountActivity.schema.indexes();
    assert.ok(
      indexes.some(
        ([fields, options]) =>
          fields.createdAt === 1 && options.expireAfterSeconds === 7776000,
      ),
    );
    assert.ok(
      indexes.some(
        ([fields]) =>
          fields.user === 1 && fields.createdAt === -1 && fields._id === -1,
      ),
    );
  });

  it('stops after the final failed storage retry', async function () {
    sinon.stub(AccountActivity, 'updateOne').callsFake(async () => {
      const error = new Error('temporary storage failure');
      error.code = 1234;
      throw error;
    });

    const recorded = await recordActivity({
      userId: new mongoose.Types.ObjectId(),
      eventType: 'password_changed',
      eventId: 'failed-retry-event',
    });
    assert.equal(recorded, false);
  });

  it('handles storage failures without a numeric database code', async function () {
    sinon.stub(AccountActivity, 'updateOne').callsFake(async () => {
      throw new Error('temporary storage failure');
    });

    const recorded = await recordActivity({
      userId: new mongoose.Types.ObjectId(),
      eventType: 'password_changed',
      eventId: 'unclassified-retry-event',
    });
    assert.equal(recorded, false);
  });
});
