import type {
  TestAgent,
  TestExpressApp,
} from '../../../../testutils/server/model-contracts.mts';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose: typeof import('mongoose') = require('mongoose');
const request: typeof import('supertest') = require('supertest');
const sinon: typeof import('sinon') = require('sinon');
const {
  finalizeEvent,
  generateSecretKey,
  nip19,
}: typeof import('nostr-tools') = require('nostr-tools');
const express: import('../../../../testutils/server/model-contracts.mts').TestExpressModule = require('../../../../config/lib/express.mjs');
const users: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const {
  default: FeaturedNote,
}: typeof import('../../../core/server/models/featured-nostr-note.server.model.mts') = require('../../../core/server/models/featured-nostr-note.server.model.mts');

describe('Admin featured Nostr notes', () => {
  const featurePath = '/api/admin/nostr/featured-notes';
  const publicPath = '/api/nostr/featured-notes';
  const author = generateSecretKey();
  const event = finalizeEvent(
    {
      kind: 1,
      created_at: 1780000000,
      tags: [['t', 'example']],
      content: 'A fictional announcement.',
    },
    author,
  );
  let app: TestExpressApp;
  let admin: TestAgent;
  let support: TestAgent;

  before(async () => {
    app = await express.init(mongoose.connection);
    const [administrator, moderator] = users.generateUsersWithSharedPassword(2);
    administrator.roles = ['user', 'admin'];
    moderator.roles = ['user', 'support-team'];
    await users.saveUsersWithCachedPasswords([administrator, moderator]);

    admin = request.agent(app);
    await admin
      .post('/api/auth/signin')
      .send({
        username: administrator.username,
        password: administrator.password,
      })
      .expect(200);

    support = request.agent(app);
    await support
      .post('/api/auth/signin')
      .send({ username: moderator.username, password: moderator.password })
      .expect(200);
  });

  afterEach(async () => {
    await FeaturedNote.deleteMany({});
  });

  after(async () => {
    await users.clearDatabase();
  });

  it('stores verified notes once, exposes only public fields and removes them', async () => {
    const expectedNote = {
      id: event.id,
      npub: nip19.npubEncode(event.pubkey),
      content: event.content,
      publishedAt: new Date(event.created_at * 1000).toISOString(),
    };
    await admin.post(featurePath).send({ event }).expect(200, expectedNote);
    const firstFeature = await FeaturedNote.findById(event.id).lean().orFail();
    await admin.post(featurePath).send({ event }).expect(200, expectedNote);
    const repeatedFeature = await FeaturedNote.findById(event.id)
      .lean()
      .orFail();
    assert.deepEqual(repeatedFeature, firstFeature);
    await request(app)
      .get(publicPath)
      .expect('Cache-Control', 'no-store')
      .expect(200, [expectedNote]);
    await admin
      .delete(`${featurePath}/${event.id}`)
      .set('X-Trustroots-Request', '1')
      .expect(204);
    const removed = await FeaturedNote.findById(event.id).lean().orFail();
    assert.equal(removed.content, '');
    assert.equal(removed.featuredAt, null);
    await request(app).get(publicPath).expect(200, []);
  });

  it('orders featured notes by most recently featured, breaking ties by ID', async () => {
    const newer = new Date('2026-03-01T00:00:00Z');
    const older = new Date('2026-02-01T00:00:00Z');
    const npub = nip19.npubEncode(event.pubkey);
    await FeaturedNote.insertMany(
      [
        { _id: 'c'.repeat(64), featuredAt: newer },
        { _id: 'a'.repeat(64), featuredAt: older },
        { _id: 'b'.repeat(64), featuredAt: newer },
      ].map(note => ({
        ...note,
        npub,
        content: event.content,
        publishedAt: new Date(event.created_at * 1000),
      })),
    );

    const sort = sinon.spy(mongoose.Query.prototype, 'sort');
    try {
      const response = await request(app).get(publicPath).expect(200);
      // MongoDB can return index order even without an explicit sort.
      sinon.assert.calledWithExactly(sort, { featuredAt: -1, _id: 1 });
      assert.deepEqual(
        response.body.map((note: { id: string }) => note.id),
        ['b'.repeat(64), 'c'.repeat(64), 'a'.repeat(64)],
      );
    } finally {
      sort.restore();
    }
  });

  it('returns an empty list without a member lookup', async () => {
    const lookup = sinon.spy(mongoose.model('User'), 'find');
    try {
      await request(app).get(publicPath).expect(200, []);
      sinon.assert.notCalled(lookup);
    } finally {
      lookup.restore();
    }
  });

  it('uses private caching headers only when author profiles are requested', async () => {
    const path = `/api/nostr/author-visibility?pubkey=${event.pubkey}`;
    const visibility = { linkedPubkeys: [], pubkeys: [] };
    const publicResponse = await request(app).get(path).expect(200, visibility);
    assert.notEqual(
      publicResponse.headers['cache-control'],
      'private, no-store',
    );
    await request(app)
      .get(`${path}&profiles=1`)
      .expect('Cache-Control', 'private, no-store')
      .expect(200, visibility);
  });

  it('rejects requests to feature or remove notes from visitors and support volunteers', async () => {
    await request(app).post(featurePath).send({ event }).expect(403);
    await support.post(featurePath).send({ event }).expect(403);
    await request(app)
      .delete(`${featurePath}/${event.id}`)
      .set('X-Trustroots-Request', '1')
      .expect(403);
    await support
      .delete(`${featurePath}/${event.id}`)
      .set('X-Trustroots-Request', '1')
      .expect(403);
  });

  it('only exposes usernames eligible for Trustroots NIP-05 lookup', async () => {
    const npub = nip19.npubEncode(event.pubkey);
    const member = await users
      .createTestUser({
        username: 'featurednoteauthor',
        nostrNpub: npub,
      })
      .save();

    const featured = await admin.post(featurePath).send({ event }).expect(200);
    assert.equal(featured.body.authorUsername, member.username);

    const listed = await request(app).get(publicPath).expect(200);
    assert.equal(listed.body[0].authorUsername, member.username);

    await member.updateOne({ public: false });
    const hidden = await request(app).get(publicPath).expect(200);
    assert.equal(hidden.body[0].authorUsername, undefined);
  });

  it('rejects malformed, non-text, and tampered events', async () => {
    const signedNote = (created_at: number, content: string) =>
      finalizeEvent({ kind: 1, created_at, tags: [], content }, author);
    for (const invalid of [
      undefined,
      { ...event, kind: 0 },
      { ...event, id: null },
      { ...event, id: [event.id] },
      { ...event, id: { toString: null, valueOf: null } },
      { ...event, id: 'invalid' },
      { ...event, created_at: 1.5 },
      signedNote(-1, event.content),
      signedNote(253402300800, event.content),
      { ...event, content: null },
      signedNote(event.created_at, '  '),
      signedNote(event.created_at, '£'.repeat(16384) + 'a'),
      { ...event, content: 'Tampered announcement.' },
      { ...event, sig: '0'.repeat(128) },
    ]) {
      await admin.post(featurePath).send({ event: invalid }).expect(400, {
        message: 'A valid signed Nostr text note is required.',
      });
    }
    await request(app).get(publicPath).expect(200, []);
  });

  it('accepts timestamps and UTF-8 content at the supported limits', async () => {
    for (const created_at of [0, 253402300799]) {
      const content = '£'.repeat(16384);
      const boundary = finalizeEvent(
        { kind: 1, created_at, tags: [], content },
        author,
      );
      await admin
        .post(featurePath)
        .send({ event: boundary })
        .expect(200, {
          id: boundary.id,
          npub: nip19.npubEncode(boundary.pubkey),
          content,
          publishedAt: new Date(created_at * 1000).toISOString(),
        });
    }
  });

  it('rejects malformed removal IDs and only removes the requested note', async () => {
    for (const invalid of [
      'a',
      `x${event.id}`,
      `${event.id}x`,
      'z'.repeat(64),
    ]) {
      await admin
        .delete(`${featurePath}/${invalid}`)
        .set('X-Trustroots-Request', '1')
        .expect(400, { message: 'A valid Nostr event ID is required.' });
    }
    const other = finalizeEvent(
      {
        kind: 1,
        created_at: event.created_at,
        tags: [],
        content: 'Another announcement.',
      },
      author,
    );
    await admin.post(featurePath).send({ event: other }).expect(200);
    await admin.post(featurePath).send({ event }).expect(200);
    await admin
      .delete(`${featurePath}/${event.id}`)
      .set('X-Trustroots-Request', '1')
      .expect(204);
    const response = await request(app).get(publicPath).expect(200);
    assert.deepEqual(
      response.body.map((note: { id: string }) => note.id),
      [other.id],
    );
  });

  it('can feature a locally removed note again', async () => {
    await admin.post(featurePath).send({ event }).expect(200);
    await admin
      .delete(`${featurePath}/${event.id}`)
      .set('X-Trustroots-Request', '1')
      .expect(204);
    await request(app).get(publicPath).expect(200, []);
    const restored = await admin.post(featurePath).send({ event }).expect(200);
    assert.equal(restored.body.content, event.content);
    const response = await request(app).get(publicPath).expect(200);
    assert.equal(response.body[0].content, event.content);
  });

  it('records an author-signed deletion even after local removal and blocks re-featuring', async () => {
    const deletion = finalizeEvent(
      {
        kind: 5,
        created_at: 1780000001,
        content: '',
        tags: [
          ['e', event.id],
          ['k', '1'],
        ],
      },
      author,
    );
    const deletionPath = `${featurePath}/${event.id}/deletion`;
    await admin.post(featurePath).send({ event }).expect(200);
    await admin
      .delete(`${featurePath}/${event.id}`)
      .set('X-Trustroots-Request', '1')
      .expect(204);
    await support.post(deletionPath).send({ event: deletion }).expect(403);
    await admin.post(deletionPath).send({ event: deletion }).expect(204);
    await admin.post(deletionPath).send({ event: deletion }).expect(204);
    await admin
      .delete(`${featurePath}/${event.id}`)
      .set('X-Trustroots-Request', '1')
      .expect(204);
    await request(app).get(publicPath).expect(200, []);
    await admin.post(featurePath).send({ event }).expect(409, {
      message: 'A deletion request was recorded for this note.',
    });
    const stored = await FeaturedNote.findById(event.id).lean().orFail();
    assert.equal(stored.content, '');
    assert.equal(stored.deletionId, deletion.id);
  });

  it('preserves the homepage copy for invalid or mismatched deletion requests', async () => {
    await admin.post(featurePath).send({ event }).expect(200);
    const template = {
      kind: 5,
      created_at: 1780000001,
      content: '',
      tags: [['e', event.id]],
    };
    const valid = finalizeEvent({ ...template }, author);
    const foreign = finalizeEvent({ ...template }, generateSecretKey());
    const unrelated = finalizeEvent(
      { ...template, tags: [['e', 'ab'.repeat(32)]] },
      author,
    );
    const wrongTag = finalizeEvent(
      { ...template, tags: [['p', event.id]] },
      author,
    );
    const wrongKind = finalizeEvent({ ...template, kind: 1 }, author);
    const deletionPath = `${featurePath}/${event.id}/deletion`;
    const invalidDeletion = {
      message: 'A signed deletion request for this note is required.',
    };
    const invalidId = 'z'.repeat(64);
    const wrongId = finalizeEvent(
      { ...template, tags: [['e', invalidId]] },
      author,
    );
    await admin
      .post(`${featurePath}/${invalidId}/deletion`)
      .send({ event: wrongId })
      .expect(400, invalidDeletion);
    for (const invalid of [
      undefined,
      wrongKind,
      { ...valid, sig: '0'.repeat(128) },
      unrelated,
      wrongTag,
    ]) {
      await admin
        .post(deletionPath)
        .send({ event: invalid })
        .expect(400, invalidDeletion);
    }
    await admin.post(deletionPath).send({ event: foreign }).expect(404, {
      message: 'No note matches the deletion request and its author.',
    });
    const response = await request(app).get(publicPath).expect(200);
    assert.equal(response.body[0].id, event.id);
  });
});
