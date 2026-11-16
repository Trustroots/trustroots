import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import sinon from 'sinon';
import { finalizeEvent, generateSecretKey, nip19 } from 'nostr-tools';
import express from './../../../../config/lib/express.mts';
import * as users from './../../../../testutils/server/data.server.testutil.mts';
import { default as FeaturedNote } from './../../server/models/featured-nostr-note.server.model.mts';
import type {
  TestAgent,
  TestExpressApp,
} from '../../../../testutils/server/model-contracts.mts';

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

  before(async () => {
    app = await express.init(mongoose.connection);
    const administrator = users.generateUsersWithSharedPassword(1)[0];
    administrator.roles = ['user', 'admin'];
    await users.saveUsersWithCachedPasswords([administrator]);

    admin = request.agent(app);
    await users.signInPrivileged(administrator, admin);
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
    const featuredAt = new Date('2026-01-01T00:00:00Z');
    await FeaturedNote.updateOne({ _id: event.id }, { $set: { featuredAt } });
    await admin.post(featurePath).send({ event }).expect(200, expectedNote);
    const stillFeatured = await FeaturedNote.findById(event.id).lean().orFail();
    assert.deepEqual(stillFeatured.featuredAt, featuredAt);
    await request(app)
      .get(publicPath)
      .expect('Cache-Control', 'no-store')
      .expect(200, [expectedNote]);
    await admin
      .delete(`${featurePath}/${event.id}`)
      .set('X-Trustroots-Request', '1')
      .expect(204);
    const findAuthors = sinon.spy(mongoose.model('User'), 'find');
    try {
      await request(app).get(publicPath).expect(200, []);
      sinon.assert.notCalled(findAuthors);
    } finally {
      findAuthors.restore();
    }
    const removed = await FeaturedNote.findById(event.id).lean().orFail();
    assert.equal(removed.content, '');
    await admin.post(featurePath).send({ event }).expect(200, expectedNote);
    const restored = await request(app).get(publicPath).expect(200);
    assert.equal(restored.body[0].content, event.content);
  });

  it('shows an author username only while their profile is public', async () => {
    const npub = nip19.npubEncode(event.pubkey);
    const member = {
      ...users.generateUsersWithSharedPassword(1)[0],
      nostrNpub: npub,
      public: true,
    };
    await users.saveUsersWithCachedPasswords([member]);

    try {
      const featureResponse = await admin
        .post(featurePath)
        .send({ event })
        .expect(200);
      assert.equal(featureResponse.body.authorUsername, member.username);

      const publicResponse = await request(app).get(publicPath).expect(200);
      assert.equal(publicResponse.body[0].authorUsername, member.username);

      await mongoose
        .model('User')
        .updateOne({ username: member.username }, { $set: { public: false } });
      const privateResponse = await request(app).get(publicPath).expect(200);
      assert.equal(privateResponse.body[0].id, event.id);
      assert.ok(!Object.hasOwn(privateResponse.body[0], 'authorUsername'));
    } finally {
      await mongoose.model('User').deleteOne({ username: member.username });
    }
  });

  it('accepts the timestamp and UTF-8 content boundaries', async () => {
    for (const [created_at, content] of [
      [0, 'A boundary note.'],
      [253402300799, 'A boundary note.'],
      [1780000000, '£'.repeat(16383) + 'ab'],
    ] as const) {
      const boundaryEvent = finalizeEvent(
        { kind: 1, created_at, tags: [], content },
        author,
      );
      await admin
        .post(featurePath)
        .send({ event: boundaryEvent })
        .expect(200, {
          id: boundaryEvent.id,
          npub: nip19.npubEncode(boundaryEvent.pubkey),
          content,
          publishedAt: new Date(created_at * 1000).toISOString(),
        });
    }
  });

  it('lists only featured notes in featured-time order with no-store caching', async () => {
    const publishedAt = new Date('2026-01-01T00:00:00Z');
    const older = '11'.repeat(32);
    const newer = '22'.repeat(32);
    const firstAtNewestTime = '00'.repeat(32);
    await FeaturedNote.create([
      {
        _id: older,
        npub: 'npub-old',
        content: 'Old',
        publishedAt,
        featuredAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        _id: newer,
        npub: 'npub-new',
        content: 'New',
        publishedAt,
        featuredAt: new Date('2026-01-02T00:00:00Z'),
      },
      {
        _id: firstAtNewestTime,
        npub: 'npub-first',
        content: 'First',
        publishedAt,
        featuredAt: new Date('2026-01-02T00:00:00Z'),
      },
      {
        _id: '33'.repeat(32),
        npub: 'npub-hidden',
        content: '',
        publishedAt,
        featuredAt: null,
      },
    ]);
    await FeaturedNote.init();
    // Prevent the index from returning the expected order without a sort.
    await FeaturedNote.collection.dropIndex('featuredAt_-1__id_1');
    try {
      await request(app)
        .get(publicPath)
        .expect('Cache-Control', 'no-store')
        .expect(200, [
          {
            id: firstAtNewestTime,
            npub: 'npub-first',
            content: 'First',
            publishedAt: publishedAt.toISOString(),
          },
          {
            id: newer,
            npub: 'npub-new',
            content: 'New',
            publishedAt: publishedAt.toISOString(),
          },
          {
            id: older,
            npub: 'npub-old',
            content: 'Old',
            publishedAt: publishedAt.toISOString(),
          },
        ]);
    } finally {
      await FeaturedNote.createIndexes();
    }
  });

  it('rejects malformed, non-text, and tampered events', async () => {
    const sign = (overrides: Partial<typeof event>) =>
      finalizeEvent(
        {
          kind: 1,
          created_at: event.created_at,
          tags: event.tags,
          content: event.content,
          ...overrides,
        },
        author,
      );
    for (const invalid of [
      undefined,
      sign({ kind: 0 }),
      { ...event, id: null },
      { ...event, id: { toString: null } },
      { ...event, id: 'invalid' },
      { ...event, id: `${'ab'.repeat(32)}x` },
      { ...event, id: `x${'ab'.repeat(32)}` },
      { ...event, created_at: 1.5 },
      sign({ created_at: -1 }),
      sign({ created_at: 253402300800 }),
      { ...event, created_at: Number.MAX_SAFE_INTEGER },
      { ...event, content: null },
      sign({ content: '  ' }),
      sign({ content: '£'.repeat(20000) }),
      { ...event, content: 'Tampered announcement.' },
      { ...event, sig: '0'.repeat(128) },
    ]) {
      await admin.post(featurePath).send({ event: invalid }).expect(400, {
        message: 'A valid signed Nostr text note is required.',
      });
    }
    for (const invalidId of [
      'invalid',
      `${'ab'.repeat(32)}x`,
      `x${'ab'.repeat(32)}`,
      'AB'.repeat(32),
      'g'.repeat(64),
    ]) {
      await admin
        .delete(`${featurePath}/${invalidId}`)
        .set('X-Trustroots-Request', '1')
        .expect(400, { message: 'A valid Nostr event ID is required.' });
    }
    await request(app).get(publicPath).expect(200, []);
  });

  it('removes and restores only the requested note', async () => {
    const other = finalizeEvent(
      {
        kind: 1,
        created_at: event.created_at,
        content: 'A separate fictional note.',
        tags: [],
      },
      author,
    );
    for (const note of [other, event]) {
      const response = await admin
        .post(featurePath)
        .send({ event: note })
        .expect(200);
      assert.equal(response.body.id, note.id);
    }
    await admin
      .delete(`${featurePath}/${event.id}`)
      .set('X-Trustroots-Request', '1')
      .expect(204);
    const response = await request(app).get(publicPath).expect(200);
    assert.deepEqual(
      response.body.map((note: { id: string }) => note.id),
      [other.id],
    );
    const restored = await admin.post(featurePath).send({ event }).expect(200);
    assert.equal(restored.body.id, event.id);
    const untouched = await FeaturedNote.findById(other.id).lean().orFail();
    assert.equal(untouched.content, other.content);
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
    const invalidId = 'invalid';
    const invalidTarget = finalizeEvent(
      { ...template, tags: [['e', invalidId]] },
      author,
    );
    const deletionPath = `${featurePath}/${event.id}/deletion`;
    await admin
      .post(`${featurePath}/${invalidId}/deletion`)
      .send({ event: invalidTarget })
      .expect(400, {
        message: 'A signed deletion request for this note is required.',
      });
    for (const invalid of [undefined, wrongKind, unrelated, wrongTag]) {
      await admin.post(deletionPath).send({ event: invalid }).expect(400, {
        message: 'A signed deletion request for this note is required.',
      });
    }
    await admin
      .post(deletionPath)
      .send({ event: { ...valid, sig: '0'.repeat(128) } })
      .expect(400, {
        message: 'A signed deletion request for this note is required.',
      });
    await admin.post(deletionPath).send({ event: foreign }).expect(404, {
      message: 'No note matches the deletion request and its author.',
    });
    const response = await request(app).get(publicPath).expect(200);
    assert.equal(response.body[0].id, event.id);
  });
});
