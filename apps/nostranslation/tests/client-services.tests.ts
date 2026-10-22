import { webcrypto } from 'node:crypto';
import { BunkerSigner, createNostrConnectURI } from 'nostr-tools/nip46';
import {
  authorisation,
  browserSigner,
  bunkerSigner,
  remoteConnection,
} from '../client/signers.ts';
import { loadDrafts, rebaseDrafts, saveDrafts } from '../client/drafts.ts';
import type { Entry } from '../shared.ts';

jest.mock('nostr-tools', () => ({
  generateSecretKey: () => new Uint8Array(32),
  getPublicKey: () => 'a'.repeat(64),
}));
jest.mock('nostr-tools/nip46', () => ({
  BunkerSigner: { fromBunker: jest.fn(), fromURI: jest.fn() },
  createNostrConnectURI: jest.fn(() => 'nostrconnect://fictional'),
}));

describe('Nostr signers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete (window as Window & { nostr?: unknown }).nostr;
  });
  it('requires a complete browser signer', () => {
    expect(() => browserSigner()).toThrow('signer');
    Object.assign(window, { nostr: { getPublicKey: jest.fn() } });
    expect(() => browserSigner()).toThrow();
    const signer = { getPublicKey: jest.fn(), signEvent: jest.fn() };
    Object.assign(window, { nostr: signer });
    expect(browserSigner()).toBe(signer);
  });
  it('connects secure bunker URLs and cleans up failed connections', async () => {
    const signer = {
      connect: jest.fn(async () => {}),
      close: jest.fn(async () => {}),
    };
    jest
      .mocked(BunkerSigner.fromBunker)
      .mockReturnValue(signer as unknown as BunkerSigner);
    const key = 'a'.repeat(64);
    await expect(
      bunkerSigner(
        `bunker://${key}?relay=${encodeURIComponent('wss://relay.example')}&secret=fictional`,
      ),
    ).resolves.toBe(signer);
    expect(BunkerSigner.fromBunker).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      { pubkey: key, relays: ['wss://relay.example'], secret: 'fictional' },
    );
    await bunkerSigner(
      `bunker://${key}?relay=${encodeURIComponent('wss://relay.example')}`,
    );
    for (const url of [
      'https://example.org',
      'bunker://wrong',
      `bunker://${key}`,
      `bunker://${key}?relay=http://example.org`,
    ])
      await expect(bunkerSigner(url)).rejects.toThrow();
    signer.connect.mockRejectedValueOnce(new Error('denied'));
    await expect(
      bunkerSigner(`bunker://${key}?relay=wss://relay.example`),
    ).rejects.toThrow('denied');
    expect(signer.close).toHaveBeenCalledTimes(1);
  });
  it('creates cancellable QR connections with only HTTP signing permissions', async () => {
    const signal = new AbortController().signal;
    const pending = remoteConnection(signal);
    expect(pending.uri).toBe('nostrconnect://fictional');
    expect(createNostrConnectURI).toHaveBeenCalledWith(
      expect.objectContaining({
        perms: ['sign_event:27235'],
        clientPubkey: 'a'.repeat(64),
      }),
    );
    await pending.connect();
    expect(BunkerSigner.fromURI).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      pending.uri,
      {},
      signal,
    );
  });
  it('signs the exact UTF-8 request body, URL and method', async () => {
    Object.defineProperty(globalThis.crypto, 'subtle', {
      configurable: true,
      value: webcrypto.subtle,
    });
    const signer = {
      getPublicKey: jest.fn(),
      signEvent: jest.fn(async event => ({
        ...event,
        pubkey: 'fictional',
        sig: 'signature',
      })),
    };
    const body = JSON.stringify({ translation: 'Grüße' });
    const header = await authorisation(
      signer,
      'https://translation-api.example/api/reviews',
      body,
    );
    expect(header).toMatch(/^Nostr /);
    const event = JSON.parse(atob(header.slice(6)));
    const hash = Buffer.from(
      await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(body)),
    ).toString('hex');
    expect(event).toMatchObject({
      kind: 27235,
      content: '',
      tags: [
        ['u', 'https://translation-api.example/api/reviews'],
        ['method', 'POST'],
        ['payload', hash],
      ],
    });
  });
});

describe('browser draft recovery', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => jest.restoreAllMocks());
  it('loads only well-formed drafts and tolerates broken or unavailable storage', () => {
    expect(loadDrafts('de')).toEqual({});
    for (const raw of ['{broken', 'null', '[]', '"text"']) {
      localStorage.setItem('nostranslation:de', raw);
      expect(loadDrafts('de')).toEqual({});
    }
    const draft = {
      value: 'Hallo',
      approved: true,
      sourceHash: 'hash',
      original: null,
    };
    expect(
      saveDrafts('de', { a: draft, b: { ...draft, original: 'old' } }),
    ).toBe(true);
    expect(loadDrafts('de').a).toEqual(draft);
    localStorage.setItem(
      'nostranslation:de',
      JSON.stringify({
        invalid: {},
        null: null,
        value: { ...draft, value: 42 },
        approved: { ...draft, approved: 'yes' },
        hash: { ...draft, sourceHash: 1 },
        original: { ...draft, original: 1 },
        good: draft,
      }),
    );
    expect(loadDrafts('de')).toEqual({ good: draft });
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadDrafts('de')).toEqual({});
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    expect(saveDrafts('de', {})).toBe(false);
  });
  it('keeps typed corrections but clears approvals when English or published wording changes', () => {
    const entry = {
      id: 'users:Hello',
      sourceHash: 'hash',
      original: 'Hallo',
    } as Entry;
    const draft = {
      value: 'Guten Tag',
      approved: true,
      sourceHash: 'hash',
      original: 'Hallo',
    };
    expect(
      rebaseDrafts({ [entry.id]: draft, removed: draft }, [entry]),
    ).toEqual({ [entry.id]: draft });
    expect(
      rebaseDrafts({ [entry.id]: draft }, [{ ...entry, sourceHash: 'new' }])[
        entry.id
      ],
    ).toMatchObject({ value: 'Guten Tag', approved: false });
    expect(
      rebaseDrafts({ [entry.id]: draft }, [{ ...entry, original: 'changed' }])[
        entry.id
      ].approved,
    ).toBe(false);
    expect(
      rebaseDrafts({ [entry.id]: { ...draft, approved: false } }, [entry])[
        entry.id
      ].approved,
    ).toBe(false);
  });
});
