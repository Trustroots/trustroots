import type {
  TestAgent,
  TestExpressApp,
} from '../../../../testutils/server/model-contracts.mts';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose: typeof import('mongoose') = require('mongoose');
const request: typeof import('supertest') = require('supertest');
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
    await admin.post(featurePath).send({ event }).expect(200, expectedNote);
    await request(app).get(publicPath).expect(200, [expectedNote]);
    await admin
      .delete(`${featurePath}/${event.id}`)
      .set('X-Trustroots-Request', '1')
      .expect(204);
    await request(app).get(publicPath).expect(200, []);
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
    for (const invalid of [
      undefined,
      { ...event, kind: 0 },
      { ...event, id: null },
      { ...event, id: 'invalid' },
      { ...event, created_at: 1.5 },
      { ...event, created_at: -1 },
      { ...event, created_at: Number.MAX_SAFE_INTEGER },
      { ...event, content: null },
      { ...event, content: '  ' },
      { ...event, content: '£'.repeat(20000) },
      { ...event, content: 'Tampered announcement.' },
      { ...event, sig: '0'.repeat(128) },
    ]) {
      await admin.post(featurePath).send({ event: invalid }).expect(400);
    }
    await admin
      .delete(`${featurePath}/invalid`)
      .set('X-Trustroots-Request', '1')
      .expect(400);
    await request(app).get(publicPath).expect(200, []);
  });

  it('can feature a locally removed note again', async () => {
    await admin.post(featurePath).send({ event }).expect(200);
    await admin
      .delete(`${featurePath}/${event.id}`)
      .set('X-Trustroots-Request', '1')
      .expect(204);
    await request(app).get(publicPath).expect(200, []);
    await admin.post(featurePath).send({ event }).expect(200);
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
    await admin.post(featurePath).send({ event }).expect(409);
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
    const deletionPath = `${featurePath}/${event.id}/deletion`;
    await admin
      .post(`${featurePath}/invalid/deletion`)
      .send({ event: valid })
      .expect(400);
    await admin.post(deletionPath).send({ event }).expect(400);
    await admin
      .post(deletionPath)
      .send({ event: { ...valid, sig: '0'.repeat(128) } })
      .expect(400);
    await admin.post(deletionPath).send({ event: unrelated }).expect(400);
    await admin.post(deletionPath).send({ event: foreign }).expect(404);
    const response = await request(app).get(publicPath).expect(200);
    assert.equal(response.body[0].id, event.id);
  });
});
