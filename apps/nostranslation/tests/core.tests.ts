/** @jest-environment node */
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools';
import { catalogue, digest } from '../server/catalogue.mts';
import { validateTranslation } from '../shared.ts';
import { Store } from '../server/store.mts';
import {
  authenticate,
  parseSubmission,
  reviewedFiles,
  ReviewService,
  verifyIdentity,
} from '../server/service.mts';
import { snapshot } from './fixtures.ts';
import type { Repository } from '../server/github.mts';
import type { Submission } from '../shared.ts';
import { validateChanged } from '../server/ci.mts';

const now = 100000;
const secret = generateSecretKey();
const pubkey = getPublicKey(secret);
const url = 'https://translation-api.example/api/reviews';
const response = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));
const fakeFetch = (body: unknown, status = 200) =>
  jest.fn(() => response(body, status)) as unknown as typeof fetch;

function batch(): Submission {
  const entry = catalogue('de', snapshot()).entries[0];
  return {
    username: 'fictional-translator',
    locale: 'de',
    changes: [
      {
        id: entry.id,
        sourceHash: entry.sourceHash,
        original: null,
        value: 'Willkommen {{name}}',
      },
    ],
  };
}

function signed(body: string, changes: Record<string, unknown> = {}) {
  const event = finalizeEvent(
    {
      kind: 27235,
      content: '',
      created_at: now,
      tags: [
        ['u', url],
        ['method', 'POST'],
        ['payload', digest(body)],
      ],
      ...changes,
    },
    secret,
  );
  return 'Nostr ' + Buffer.from(JSON.stringify(event)).toString('base64');
}

describe('translation formats and catalogue', () => {
  it('preserves plural formats for German, Arabic and English source context', () => {
    const german = catalogue('de', snapshot());
    expect(
      german.entries
        .filter(entry => entry.key.includes('guests'))
        .map(entry => [entry.key, entry.source]),
    ).toEqual([
      ['{{count}} guests_one', '{{count}} guest'],
      ['{{count}} guests_other', '{{count}} guests'],
    ]);
    expect(
      catalogue('ar', snapshot()).entries.filter(entry =>
        entry.key.includes('guests'),
      ),
    ).toEqual(
      ['zero', 'one', 'two', 'few', 'many', 'other'].map(category =>
        expect.objectContaining({
          key: '{{count}} guests_' + category,
          source: category === 'one' ? '{{count}} guest' : '{{count}} guests',
        }),
      ),
    );
    expect(
      german.entries.find(entry => entry.key === 'Hello')?.needsReview,
    ).toBe(false);
    expect(() => catalogue('en', snapshot())).toThrow('Unsupported');
    expect(() => catalogue('../invalid', snapshot())).toThrow('Unsupported');
    const changed = snapshot();
    changed.reviews['users:Hello'] = {
      sourceHash: 'old',
      value: 'Hallo',
      reviewer: 'fictional',
      previous: null,
      reviewedAt: '2026-01-01',
    };
    expect(
      catalogue('de', changed).entries.find(entry => entry.key === 'Hello')
        ?.needsReview,
    ).toBe(true);
    changed.reviews['users:Hello'].sourceHash = catalogue(
      'de',
      snapshot(),
    ).entries.find(entry => entry.key === 'Hello')!.sourceHash;
    expect(
      catalogue('de', changed).entries.find(entry => entry.key === 'Hello')
        ?.needsReview,
    ).toBe(false);
    changed.target = {};
    expect(
      catalogue('de', changed).entries.every(entry => entry.original === null),
    ).toBe(true);
  });

  it.each([
    ['Hello', 'Hallo', null],
    ['Hi {{name}}', 'Hallo {{name}}', null],
    ['Hi {{name}}', 'Hallo', 'placeholder'],
    ['Hi', '{{name}}', 'placeholder'],
    ['Hi {{name}}', '{{{name}}}', 'placeholder'],
    ['Hi', '', 'Enter'],
    ['Hi', ' '.repeat(10001), 'Enter'],
    ['<0>Hello</0>', 'Hallo', 'formatting'],
    ['<0><1>Hi</1></0>', '<0><1>Hallo</0></1>', 'nested'],
    ['<0>Hello', '<0>Hallo', 'Close'],
    ['<0>Hi</0>', '<0>Hallo</0>', null],
  ])('validates %s / %s', (source, value, expected) => {
    const result = validateTranslation(source, value);
    if (expected) expect(result).toContain(expected);
    else expect(result).toBeNull();
  });

  it('preserves unchanged nested values and renamed legacy plural text', () => {
    const state = snapshot();
    const before = {
      nested: { '': 'Existing text' },
      '{{count}} guests': 'Existing singular',
      '{{count}} guests_plural': 'Existing plural',
      '{{count}} guests_2': 'Existing numeric plural',
      unrelated_2: 'Unrelated text',
    } as unknown as Record<string, string>;
    const after = {
      nested: { '': 'Existing text' },
      '{{count}} guests_one': 'Existing singular',
      '{{count}} guests_other': 'Existing plural',
    } as unknown as Record<string, string>;
    expect(validateChanged('de', 'users', before, after, state)).toEqual([]);
    after['{{count}} guests_other'] = 'Existing numeric plural';
    expect(validateChanged('de', 'users', before, after, state)).toEqual([]);
    for (const value of ['Edited without placeholder', 'Unrelated text']) {
      after['{{count}} guests_other'] = value;
      expect(validateChanged('de', 'users', before, after, state)).toHaveLength(
        1,
      );
    }
    after['{{count}} guests_other'] = 'Existing plural';
    after['{{count}} guests_plural'] = 'Existing plural';
    expect(validateChanged('de', 'users', before, after, state)).toHaveLength(
      1,
    );
    after['{{count}} guests_few'] = 'Existing singular';
    expect(validateChanged('de', 'users', before, after, state)).toHaveLength(
      2,
    );
  });

  it('checks only changed values rather than failing on unrelated legacy strings', () => {
    const state = snapshot();
    expect(
      validateChanged(
        'de',
        'users',
        { 'Welcome {{name}}': 'old invalid' },
        { 'Welcome {{name}}': 'old invalid', Hello: 'Guten Tag' },
        state,
      ),
    ).toEqual([]);
    expect(
      validateChanged(
        'de',
        'users',
        {},
        {
          'Welcome {{name}}': 'Missing token',
          unexpected: 'bad',
          Hello: 42 as unknown as string,
        },
        state,
      ),
    ).toHaveLength(3);
  });
});

describe('authenticated human review', () => {
  it('uses the deployed identity endpoint by default', async () => {
    const mocked = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(fakeFetch({ names: { fictional: pubkey } }));
    await verifyIdentity('fictional', pubkey);
    mocked.mockRestore();
  });
  it('requires a fresh, signed, exact URL/method/body-bound request', () => {
    const body = JSON.stringify(batch());
    expect(authenticate(signed(body), body, url, now).pubkey).toBe(pubkey);
    for (const header of [undefined, 'Basic abc', 'Nostr broken'])
      expect(() => authenticate(header, body, url, now)).toThrow('sign');
    for (const changes of [
      { kind: 1 },
      { content: 'x' },
      { created_at: now - 61 },
      { tags: [] },
      {
        tags: [
          ['u', url],
          ['u', url],
          ['method', 'POST'],
          ['payload', digest(body)],
        ],
      },
      { tags: [['u', url, 'extra']] },
    ])
      expect(() => authenticate(signed(body, changes), body, url, now)).toThrow(
        'sign',
      );
    expect(() => authenticate(signed(body), body + ' ', url, now)).toThrow();
    expect(() => authenticate(signed(body), body, url + '?x=1', now)).toThrow();
    const invalid = JSON.parse(
      Buffer.from(signed(body).slice(6), 'base64').toString(),
    );
    invalid.sig = '0'.repeat(128);
    expect(() =>
      authenticate(
        'Nostr ' + Buffer.from(JSON.stringify(invalid)).toString('base64'),
        body,
        url,
        now,
      ),
    ).toThrow();
  });

  it('verifies only the matching public Trustroots identity', async () => {
    const fetcher = fakeFetch({
      names: { 'fictional-translator': pubkey.toUpperCase() },
    });
    await verifyIdentity('fictional-translator', pubkey, fetcher);
    expect(fetcher).toHaveBeenCalledWith(
      'https://trustroots.org/.well-known/nostr.json?name=fictional-translator',
      expect.objectContaining({ redirect: 'error' }),
    );
    await expect(
      verifyIdentity('fictional-translator', pubkey, fakeFetch({ names: {} })),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      verifyIdentity('fictional-translator', pubkey, fakeFetch({})),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      verifyIdentity('fictional-translator', pubkey, fakeFetch({}, 500)),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('validates batches and writes corrections with durable feedback metadata', () => {
    expect(parseSubmission(batch())).toEqual(batch());
    expect(() => parseSubmission({ ...batch(), locale: '../en' })).toThrow(
      'Invalid',
    );
    expect(() => parseSubmission({ ...batch(), changes: [] })).toThrow();
    const files = reviewedFiles(
      batch(),
      snapshot(),
      'fictional@trustroots.org',
      now,
    );
    expect(files.map(file => file.path)).toEqual([
      'public/locales/de/users.json',
      'apps/nostranslation/reviews/de.json',
    ]);
    expect(JSON.parse(files[0].content).Hello).toBe('Hallo');
    expect(
      JSON.parse(files[1].content)['users:Welcome {{name}}'],
    ).toMatchObject({
      value: 'Willkommen {{name}}',
      previous: null,
      reviewer: 'fictional@trustroots.org',
    });
    const improvement = batch();
    const entry = catalogue('de', snapshot()).entries.find(
      item => item.key === 'Hello',
    )!;
    improvement.changes = [
      {
        id: entry.id,
        sourceHash: entry.sourceHash,
        original: entry.original,
        value: 'Guten Tag',
      },
    ];
    expect(
      JSON.parse(
        reviewedFiles(improvement, snapshot(), 'fictional', now)[1].content,
      )['users:Hello'].previous,
    ).toBe('Hallo');
    const missingNamespace = snapshot();
    missingNamespace.target = {};
    expect(
      reviewedFiles(batch(), missingNamespace, 'fictional', now),
    ).toHaveLength(2);
  });

  it('rejects duplicates, invalid formatting and stale source/target edits', () => {
    const duplicate = batch();
    duplicate.changes.push(duplicate.changes[0]);
    expect(() =>
      reviewedFiles(duplicate, snapshot(), 'fictional', now),
    ).toThrow('only once');
    const bad = batch();
    bad.changes[0].value = 'Missing token';
    expect(() => reviewedFiles(bad, snapshot(), 'fictional', now)).toThrow(
      'placeholder',
    );
    for (const patch of [
      { id: 'unknown' },
      { sourceHash: 'b'.repeat(64) },
      { original: 'changed' },
    ]) {
      const stale = batch();
      Object.assign(stale.changes[0], patch);
      expect(() => reviewedFiles(stale, snapshot(), 'fictional', now)).toThrow(
        'changed',
      );
    }
  });
});

describe('durable draft and PR recovery', () => {
  let store: Store;
  beforeEach(() => {
    store = new Store(':memory:');
  });
  afterEach(() => store.close());

  it('queues legacy translations when their English values change, then clears the queue after a current review is merged', () => {
    const state = snapshot();
    store.withDrafts(catalogue('de', state));
    state.source.users.Hello = 'Hello again';
    const changed = store.withDrafts(catalogue('de', state));
    const entry = changed.entries.find(item => item.key === 'Hello')!;
    expect(entry.needsReview).toBe(true);
    state.reviews[entry.id] = {
      sourceHash: entry.sourceHash,
      value: 'Different external edit',
      previous: 'Hallo',
      reviewer: 'fictional',
      reviewedAt: '2026-01-01',
    };
    expect(
      store
        .withDrafts(catalogue('de', state))
        .entries.find(item => item.id === entry.id)?.needsReview,
    ).toBe(true);
    state.reviews[entry.id].value = 'Hallo';
    expect(
      store
        .withDrafts(catalogue('de', state))
        .entries.find(item => item.id === entry.id)?.needsReview,
    ).toBe(false);
  });

  it('keeps drafts bound to source and target values, and expires used signatures', () => {
    const current = catalogue('de', snapshot());
    const entry = current.entries[0];
    expect(store.withDrafts(current)).toEqual(current);
    store.saveDraft(
      'de',
      entry,
      'Willkommen {{name}}',
      'test-model',
      current.revision,
    );
    expect(store.withDrafts(current).entries[0]).toMatchObject({
      suggestion: 'Willkommen {{name}}',
      model: 'test-model',
    });
    entry.sourceHash = 'new';
    expect(store.withDrafts(current).entries[0].suggestion).toBeUndefined();
    entry.sourceHash = catalogue('de', snapshot()).entries[0].sourceHash;
    entry.original = 'changed';
    expect(store.withDrafts(current).entries[0].suggestion).toBeUndefined();
    expect(store.consumeSignature('id', now)).toBe(true);
    expect(store.consumeSignature('id', now)).toBe(false);
    expect(store.consumeSignature('id', now + 121)).toBe(true);
    for (let index = 0; index < 5; index++)
      expect(store.reserve(String(index), pubkey, now)).toBe(true);
    expect(store.reserve('0', pubkey, now)).toBe(true);
    expect(store.reserve('6', pubkey, now)).toBe(false);
    expect(store.reserve('6', pubkey, now + 3601)).toBe(true);
  });

  function service(existing?: string) {
    const repo = {
      load: jest.fn(async () => snapshot()),
      publish: jest.fn(
        async () => 'https://github.com/Trustroots/trustroots/pull/99999',
      ),
      existingPR: jest.fn(async () => existing),
    };
    const identity = jest.fn(async () => {});
    return {
      repo,
      identity,
      review: new ReviewService(repo as unknown as Repository, store, identity),
    };
  }

  it('creates one draft PR and reuses its result on retries', async () => {
    const { repo, identity, review } = service();
    const result = await review.submit(batch(), pubkey, now);
    expect(await review.submit(batch(), pubkey, now)).toBe(result);
    expect(repo.publish).toHaveBeenCalledTimes(1);
    expect(identity).toHaveBeenCalledTimes(2);
    expect(repo.publish.mock.calls[0]).toEqual(
      expect.arrayContaining([expect.stringMatching(/^codex\/translation-/)]),
    );
  });

  it('recovers an existing PR after a process interruption', async () => {
    const { repo, review } = service(
      'https://github.com/Trustroots/trustroots/pull/99999',
    );
    expect(await review.submit(batch(), pubkey, now)).toContain('/pull/');
    expect(repo.load).not.toHaveBeenCalled();
    expect(repo.publish).not.toHaveBeenCalled();
  });

  it('retains retry state after GitHub failure and blocks overlapping submissions', async () => {
    const { repo, review } = service();
    let finish: (value: string) => void = () => {};
    repo.publish.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const pending = review.submit(batch(), pubkey, now);
    await new Promise(resolve => setImmediate(resolve));
    await expect(review.submit(batch(), pubkey, now)).rejects.toMatchObject({
      status: 409,
    });
    finish('https://github.com/Trustroots/trustroots/pull/99999');
    await pending;
    const another = batch();
    another.changes[0].value = 'Guten Tag {{name}}';
    repo.publish.mockRejectedValueOnce(new Error('offline'));
    await expect(review.submit(another, pubkey, now)).rejects.toThrow(
      'offline',
    );
    await expect(review.submit(another, pubkey, now)).resolves.toContain(
      '/pull/',
    );
  });

  it('enforces per-key submission limits and identity eligibility before writes', async () => {
    const { repo, review, identity } = service();
    for (let index = 0; index < 5; index++)
      store.reserve(String(index), pubkey, now);
    await expect(review.submit(batch(), pubkey, now)).rejects.toMatchObject({
      status: 429,
    });
    identity.mockRejectedValueOnce(new Error('identity unavailable'));
    await expect(review.submit(batch(), pubkey, now)).rejects.toThrow(
      'identity unavailable',
    );
    expect(repo.publish).not.toHaveBeenCalled();
  });
});
