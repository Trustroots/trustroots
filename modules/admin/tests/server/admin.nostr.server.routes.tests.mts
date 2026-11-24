import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import sinon from 'sinon';
import {
  finalizeEvent,
  generateSecretKey,
  nip19,
  verifyEvent,
} from 'nostr-tools';
import { Relay } from 'nostr-tools/relay';
import { vi } from 'vitest';
import express from '../../../../config/lib/express.mts';
import * as users from '../../../../testutils/server/data.server.testutil.mts';
import { default as FeaturedNote } from '../../../core/server/models/featured-nostr-note.server.model.mts';
import { FEATURED_ARTICLE_KIND } from '../../../core/shared/featured-nostr-notes.mts';
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

  it('publishes the domain profile with the service key for administrators only', async () => {
    const route = '/api/admin/nostr/service-profile';
    await support.post(route).set('X-Trustroots-Request', '1').expect(403);
    const publishProfile = () =>
      admin.post(route).set('X-Trustroots-Request', '1');
    vi.stubEnv('TRUSTROOTS_NOSTR_SERVICE_NSEC', '');
    try {
      await publishProfile().expect(503);
      vi.stubEnv('TRUSTROOTS_NOSTR_SERVICE_NSEC', nip19.nsecEncode(author));
      const connect = vi.spyOn(Relay.prototype, 'connect').mockResolvedValue();
      const close = vi
        .spyOn(Relay.prototype, 'close')
        .mockImplementation(() => {});
      const publish = vi
        .spyOn(Relay.prototype, 'publish')
        .mockResolvedValue('accepted');
      const result = await publishProfile().expect(200);
      const [profile] = publish.mock.calls[0]!;
      assert.equal(result.body.id, profile.id);
      assert.equal(verifyEvent(profile), true);
      assert.equal(profile.pubkey, event.pubkey);
      assert.equal(profile.kind, 0);
      assert.deepEqual(JSON.parse(profile.content), {
        name: 'Trustroots',
        nip05: '_@trustroots.org',
      });
      assert.equal(connect.mock.calls.length, 1);
      assert.equal(close.mock.calls.length, 1);
      publish.mockRejectedValueOnce(new Error('relay unavailable'));
      await publishProfile().expect(502);
      assert.equal(close.mock.calls.length, 2);
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
    }
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
      signedNote(1.5, event.content),
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

  it('revises a legacy note in place with a verified addressable version', async () => {
    const publishedAt = new Date(event.created_at * 1000).toISOString();
    const path = `${featurePath}/${event.id}`;
    await admin.post(featurePath).send({ event }).expect(200);
    const { featuredAt } = await FeaturedNote.findById(event.id)
      .lean()
      .orFail();
    const template = {
      kind: FEATURED_ARTICLE_KIND,
      created_at: event.created_at + 1,
      content: 'Corrected fictional announcement.',
      tags: [
        ['d', event.id],
        ['published_at', String(event.created_at)],
      ],
    };
    const first = finalizeEvent({ ...template }, author);
    const foreign = finalizeEvent({ ...template }, generateSecretKey());
    await support.put(path).send({ event: first }).expect(403);
    await admin.put(path).send({ event: foreign }).expect(404, {
      message: 'No featured note matches this update and its author.',
    });
    const stableAddressError = {
      message:
        'The revision must keep the original article address and publication date.',
    };
    for (const tags of [
      [],
      [['d', 'unrelated'], template.tags[1]],
      [
        ['d', event.id],
        ['published_at', String(event.created_at - 1)],
      ],
    ]) {
      await admin
        .put(path)
        .send({ event: finalizeEvent({ ...template, tags }, author) })
        .expect(400, stableAddressError);
    }
    const signatureError = {
      message: 'A valid signed Nostr article revision is required.',
    };
    await admin
      .put(`${featurePath}/invalid`)
      .send({ event: first })
      .expect(400, signatureError);
    await admin.put(path).send({}).expect(400, signatureError);
    await admin.put(path).send({ event }).expect(400, signatureError);
    await admin
      .put(path)
      .send({ event: { ...first, sig: '0'.repeat(128) } })
      .expect(400, signatureError);
    // An administrator can feature an acknowledged revision before its author
    // saves it in the editor. Both paths must resolve to the original row.
    const featuredArticle = await admin
      .post(featurePath)
      .send({ event: first })
      .expect(200);
    assert.equal(featuredArticle.body.id, event.id);
    await admin
      .put(path)
      .send({ event: first })
      .expect(200, {
        id: event.id,
        npub: nip19.npubEncode(event.pubkey),
        content: first.content,
        publishedAt,
        article: {
          identifier: event.id,
          eventId: first.id,
          createdAt: first.created_at,
        },
      });
    await admin.put(path).send({ event: first }).expect(200);
    const next = finalizeEvent(
      {
        ...template,
        created_at: first.created_at + 1,
        content: 'Final fictional announcement.',
      },
      author,
    );
    await admin.put(path).send({ event: next }).expect(200);
    await admin.put(path).send({ event: first }).expect(409, {
      message: 'This update already has a newer revision.',
    });
    // Featuring through the stable article address resolves to the same row.
    await admin.post(featurePath).send({ event: next }).expect(200);
    await admin.post(featurePath).send({ event }).expect(200);
    const listed = await request(app).get(publicPath).expect(200);
    assert.equal(listed.body.length, 1);
    assert.equal(listed.body[0].id, event.id);
    assert.equal(listed.body[0].publishedAt, publishedAt);
    assert.equal(listed.body[0].content, next.content);
    assert.deepEqual(
      (await FeaturedNote.findById(event.id).lean().orFail()).featuredAt,
      featuredAt,
    );

    const deletion = finalizeEvent(
      {
        kind: 5,
        created_at: next.created_at,
        content: '',
        tags: [
          ['a', `${FEATURED_ARTICLE_KIND}:${event.pubkey}:${event.id}`],
          ['k', String(FEATURED_ARTICLE_KIND)],
        ],
      },
      author,
    );
    await admin.post(`${path}/deletion`).send({ event: deletion }).expect(204);
    await admin.post(featurePath).send({ event: next }).expect(409, {
      message: 'A deletion request was recorded for this note.',
    });
    await admin.post(featurePath).send({ event }).expect(409);
    await request(app).get(publicPath).expect(200, []);
  });

  it('features and restores the latest article at its stable address', async () => {
    const template = {
      kind: FEATURED_ARTICLE_KIND,
      created_at: event.created_at,
      tags: [['d', 'fictional:update']],
      content: 'An independent article.',
    };
    const variants = ['An independent article.', 'An alternate article.']
      .map(content => finalizeEvent({ ...template, content }, author))
      .sort((a, b) => a.id.localeCompare(b.id));
    const [latest, previous] = variants;
    const { body: original } = await admin
      .post(featurePath)
      .send({ event: previous })
      .expect(200);
    const path = `${featurePath}/${original.id}`;
    const { body: revised } = await admin
      .post(featurePath)
      .send({ event: latest })
      .expect(200);
    assert.equal(revised.id, original.id);
    assert.equal(revised.article.eventId, latest.id);
    assert.equal(revised.article.identifier, 'fictional:update');
    const update = sinon.spy(FeaturedNote, 'findOneAndUpdate');
    try {
      await admin
        .post(featurePath)
        .send({ event: latest })
        .expect(200, revised);
      assert.equal(
        update.callCount,
        1,
        'an already featured revision requires no second write',
      );
    } finally {
      update.restore();
    }
    await admin.delete(path).set('X-Trustroots-Request', '1').expect(204);
    await admin.post(featurePath).send({ event: previous }).expect(409, {
      message: 'Find the current revision to feature this update again.',
    });
    await admin.post(featurePath).send({ event: latest }).expect(200, revised);
    await request(app).get(publicPath).expect(200, [revised]);
  });

  it('validates article metadata and accepts its byte and timestamp boundaries', async () => {
    const identifier = '£'.repeat(256);
    const template = {
      kind: FEATURED_ARTICLE_KIND,
      created_at: event.created_at,
      content: 'A fictional article.',
    };
    for (const tags of [
      [],
      [
        ['d', identifier],
        ['d', 'duplicate'],
      ],
      [['d', identifier + 'a']],
      [
        ['d', identifier],
        ['published_at', '+1'],
      ],
      [
        ['d', identifier],
        ['published_at', '1 '],
      ],
      [
        ['d', identifier],
        ['published_at', String(event.created_at + 1)],
      ],
    ]) {
      await admin
        .post(featurePath)
        .send({
          event: finalizeEvent({ ...template, tags }, author),
        })
        .expect(400, {
          message:
            'A signed update needs a valid article address and publication date.',
        });
    }
    const boundary = finalizeEvent(
      {
        ...template,
        tags: [
          ['d', identifier],
          ['published_at', '0'],
        ],
      },
      author,
    );
    const response = await admin
      .post(featurePath)
      .send({ event: boundary })
      .expect(200);
    assert.equal(response.body.article.identifier, identifier);
    assert.equal(response.body.publishedAt, '1970-01-01T00:00:00.000Z');
  });

  it('keeps the newer revision even when an earlier revision has a lower event ID', async () => {
    const key = new Uint8Array(32).fill(6);
    const template = {
      kind: FEATURED_ARTICLE_KIND,
      tags: [
        ['d', 'fictional-chronology'],
        ['published_at', '1780000000'],
      ],
    };
    const earlier = finalizeEvent(
      {
        ...template,
        created_at: 1780000000,
        content: 'A fictional earlier revision.',
      },
      key,
    );
    const current = finalizeEvent(
      {
        ...template,
        created_at: 1780000001,
        content: 'A fictional current revision.',
      },
      key,
    );
    assert.ok(earlier.id < current.id);
    const { body: featured } = await admin
      .post(featurePath)
      .send({ event: current })
      .expect(200);
    await admin
      .put(`${featurePath}/${featured.id}`)
      .send({ event: earlier })
      .expect(409, {
        message: 'This update already has a newer revision.',
      });
    await admin
      .post(featurePath)
      .send({ event: earlier })
      .expect(200, featured);
    await request(app).get(publicPath).expect(200, [featured]);
  });

  it('deduplicates either filing order for an older note and its addressable version', async () => {
    const first = finalizeEvent(
      {
        kind: FEATURED_ARTICLE_KIND,
        created_at: event.created_at + 1,
        tags: [
          ['d', event.id],
          ['published_at', String(event.created_at)],
        ],
        content: 'An existing article version.',
      },
      author,
    );
    const { body: article } = await admin
      .post(featurePath)
      .send({ event: first })
      .expect(200);
    await admin.post(featurePath).send({ event }).expect(200, article);
    await admin
      .delete(`${featurePath}/${article.id}`)
      .set('X-Trustroots-Request', '1')
      .expect(204);
    await admin.post(featurePath).send({ event }).expect(409, {
      message: 'Feature the current article to restore this updated note.',
    });
    await FeaturedNote.deleteMany({});
    await admin.post(featurePath).send({ event }).expect(200);
    const { body: converted } = await admin
      .put(`${featurePath}/${event.id}`)
      .send({ event: first })
      .expect(200);
    assert.equal(converted.id, event.id);
    await admin
      .delete(`${featurePath}/${event.id}`)
      .set('X-Trustroots-Request', '1')
      .expect(204);
    await admin.post(featurePath).send({ event }).expect(409, {
      message: 'Feature the current article to restore this updated note.',
    });
    await admin.post(featurePath).send({ event: first }).expect(200, converted);
    await request(app).get(publicPath).expect(200, [converted]);
  });

  it('keeps an occupied identifier tied to the matching author, date and address', async () => {
    await admin.post(featurePath).send({ event }).expect(200);
    const template = {
      kind: FEATURED_ARTICLE_KIND,
      created_at: event.created_at,
      tags: [['d', event.id]],
      content: 'Another fictional article.',
    };
    const foreign = finalizeEvent(template, generateSecretKey());
    const dated = finalizeEvent(
      {
        ...template,
        tags: [
          ['d', event.id],
          ['published_at', '1'],
        ],
      },
      author,
    );
    for (const article of [foreign, dated]) {
      const response = await admin
        .post(featurePath)
        .send({ event: article })
        .expect(200);
      assert.notEqual(response.body.id, event.id);
    }
    const initial = await admin
      .post(featurePath)
      .send({
        event: finalizeEvent(
          { ...template, tags: [['d', 'original-article']] },
          author,
        ),
      })
      .expect(200);
    const other = await admin
      .post(featurePath)
      .send({
        event: finalizeEvent(
          { ...template, tags: [['d', initial.body.id]] },
          author,
        ),
      })
      .expect(200);
    assert.notEqual(other.body.id, initial.body.id);
    const listing = await request(app).get(publicPath).expect(200);
    assert.equal(listing.body.length, 5);
    assert.equal(
      (await FeaturedNote.findById(event.id).lean().orFail()).content,
      event.content,
    );
  });

  it('reports a conflict when another write wins before the revision is saved', async () => {
    await admin.post(featurePath).send({ event }).expect(200);
    const { featuredAt } = await FeaturedNote.findById(event.id)
      .lean()
      .orFail();
    const revision = finalizeEvent(
      {
        kind: FEATURED_ARTICLE_KIND,
        created_at: event.created_at + 1,
        tags: [
          ['d', event.id],
          ['published_at', String(event.created_at)],
        ],
        content: 'A concurrent correction.',
      },
      author,
    );
    const findOneAndUpdate = FeaturedNote.findOneAndUpdate.bind(FeaturedNote);
    const update = sinon
      .stub(FeaturedNote, 'findOneAndUpdate')
      .callsFake((...args) =>
        findOneAndUpdate(...args).pre(async () => {
          await FeaturedNote.updateOne(
            { _id: event.id },
            { $set: { featuredAt: null } },
          );
        }),
      );
    const conflict = {
      message: 'This update changed. Reload the page and try again.',
    };
    try {
      await admin
        .put(`${featurePath}/${event.id}`)
        .send({ event: revision })
        .expect(409, conflict);
      await FeaturedNote.updateOne({ _id: event.id }, { $set: { featuredAt } });
      await admin
        .post(featurePath)
        .send({ event: revision })
        .expect(409, conflict);
    } finally {
      update.restore();
    }
    await request(app).get(publicPath).expect(200, []);
    assert.equal(
      (await FeaturedNote.findById(event.id).lean().orFail()).content,
      event.content,
    );
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

  it('requires a current deletion request addressed to the featured article', async () => {
    const identifier = 'fictional-deletion-target';
    const revisionAt = event.created_at + 2;
    const article = finalizeEvent(
      {
        kind: FEATURED_ARTICLE_KIND,
        created_at: revisionAt,
        content: 'A fictional published update.',
        tags: [['d', identifier]],
      },
      author,
    );
    const { body: featured } = await admin
      .post(featurePath)
      .send({ event: article })
      .expect(200);
    const address = `${FEATURED_ARTICLE_KIND}:${article.pubkey}:${identifier}`;
    const invalidDeletion = {
      message: 'A signed deletion request for this note is required.',
    };

    for (const [tag, value, createdAt] of [
      ['a', `${address}-other`, revisionAt],
      ['e', address, revisionAt],
      ['a', address, revisionAt - 1],
    ] as const) {
      const deletion = finalizeEvent(
        {
          kind: 5,
          created_at: createdAt,
          content: '',
          tags: [[tag, value]],
        },
        author,
      );
      await admin
        .post(`${featurePath}/${featured.id}/deletion`)
        .send({ event: deletion })
        .expect(400, invalidDeletion);
    }

    const missingId = 'ab'.repeat(32);
    const missingDeletion = finalizeEvent(
      {
        kind: 5,
        created_at: revisionAt,
        content: '',
        tags: [['e', missingId]],
      },
      author,
    );
    await admin
      .post(`${featurePath}/${missingId}/deletion`)
      .send({ event: missingDeletion })
      .expect(404, {
        message: 'No note matches the deletion request and its author.',
      });
    await request(app).get(publicPath).expect(200, [featured]);

    const currentDeletion = finalizeEvent(
      {
        kind: 5,
        created_at: revisionAt,
        content: '',
        tags: [['a', address]],
      },
      author,
    );
    await admin
      .post(`${featurePath}/${featured.id}/deletion`)
      .send({ event: currentDeletion })
      .expect(204);
    await request(app).get(publicPath).expect(200, []);
  });
});
