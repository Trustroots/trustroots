import { finalizeEvent, getPublicKey, type EventTemplate } from 'nostr-tools';
import { neventEncode, noteEncode, npubEncode } from 'nostr-tools/nip19';
import { SimplePool } from 'nostr-tools/pool';
import http from '@/modules/core/client/api/http-client';
import { FEATURED_NOTE_RELAYS } from '@/modules/core/shared/featured-nostr-notes.mts';
import {
  featureNostrNote,
  publishNostrNoteDeletion,
  publishNostrTextNote,
  recordNostrNoteDeletion,
  removeFeaturedNostrNote,
  signNostrTextNote,
} from '@/modules/admin/client/api/featured-nostr-notes.api';

jest.mock('nostr-tools/pool', () => ({ SimplePool: jest.fn() }));

const id = 'ab'.repeat(32);
const event = { id, kind: 1, content: 'A fictional note.' };
const featuredNote = { id, content: event.content };
const get = jest.fn();
const destroy = jest.fn();
const publish = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
  jest
    .mocked(SimplePool)
    .mockImplementation(
      () => ({ get, destroy, publish }) as unknown as SimplePool,
    );
});

afterEach(() => jest.restoreAllMocks());

it.each([
  id.toUpperCase(),
  noteEncode(id),
  `nostr:${neventEncode({ id, relays: ['wss://example.test'] })}`,
  `https://example.test/posts/${noteEncode(id)}/?x=1`,
])(
  'resolves a reference on supported relays and submits the signed event',
  async reference => {
    get.mockResolvedValue(event);
    const post = jest
      .spyOn(http, 'post')
      .mockResolvedValue({ data: featuredNote });
    await expect(featureNostrNote(reference)).resolves.toEqual(featuredNote);
    expect(get).toHaveBeenCalledWith(
      FEATURED_NOTE_RELAYS,
      { ids: [id], kinds: [1] },
      { maxWait: 5000 },
    );
    expect(post).toHaveBeenCalledWith(
      '/api/admin/nostr/featured-notes',
      { event },
      { expectedStatuses: [400, 409] },
    );
    expect(destroy).toHaveBeenCalledTimes(1);
  },
);

it.each([npubEncode(id), 'note1invalid', 'https://example.test', 'https://'])(
  'rejects invalid references before contacting relays',
  async reference => {
    await expect(featureNostrNote(reference)).rejects.toThrow(
      'Enter a Nostr note link or event ID.',
    );
    expect(SimplePool).not.toHaveBeenCalled();
  },
);

it('closes relay connections if the event cannot be found', async () => {
  get.mockResolvedValue(null);
  await expect(featureNostrNote(id)).rejects.toThrow(
    'Could not find that text note',
  );
  expect(destroy).toHaveBeenCalledTimes(1);
});

it('removes a featured note by event ID', async () => {
  const remove = jest.spyOn(http, 'delete').mockResolvedValue({});
  await removeFeaturedNostrNote(id);
  expect(remove).toHaveBeenCalledWith(`/api/admin/nostr/featured-notes/${id}`);
});

describe('NIP-07 text notes', () => {
  const author = new Uint8Array(32).fill(7);
  const publicKey = getPublicKey(author);
  const content = 'A fictional note.\nSecond line.';
  const signEvent = jest.fn();

  beforeEach(() => {
    signEvent.mockImplementation(async (template: Record<string, unknown>) => ({
      ...finalizeEvent({ ...template } as unknown as EventTemplate, author),
    }));
    window.nostr = { getPublicKey: async () => publicKey, signEvent };
  });
  afterEach(() => delete window.nostr);

  it('signs the requested text and requires a relay acknowledgement', async () => {
    const signed = await signNostrTextNote(content);
    expect(signed).toMatchObject({
      kind: 1,
      pubkey: publicKey,
      content,
      tags: [],
    });
    expect(signEvent).toHaveBeenCalledWith({
      kind: 1,
      created_at: signed.created_at,
      content,
      tags: [],
    });
    publish
      .mockImplementationOnce(() => [Promise.reject(new Error('Offline'))])
      .mockImplementationOnce(() => [Promise.resolve('accepted')]);
    await expect(publishNostrTextNote(signed)).rejects.toThrow(
      'wss://relay.trustroots.org did not acknowledge publication.',
    );
    await publishNostrTextNote(signed);
    expect(publish).toHaveBeenLastCalledWith(
      ['wss://relay.trustroots.org'],
      signed,
      { maxWait: 5000 },
    );
    expect(destroy).toHaveBeenCalledTimes(2);
  });

  it('rejects blank and oversized notes before asking for a signature', async () => {
    await expect(signNostrTextNote('   ')).rejects.toThrow('Enter a note');
    await expect(signNostrTextNote('🌍'.repeat(8193))).rejects.toThrow(
      '32 KiB',
    );
    expect(signEvent).not.toHaveBeenCalled();
  });

  it.each([undefined, { getPublicKey: async () => publicKey }])(
    'requires both NIP-07 methods',
    async signer => {
      window.nostr = signer;
      await expect(signNostrTextNote(content)).rejects.toThrow(
        'Connect a NIP-07 browser signer',
      );
    },
  );

  it.each(['different content', 'different key'])(
    'rejects a signature with %s',
    async change => {
      signEvent.mockImplementationOnce(async template => ({
        ...finalizeEvent(
          {
            ...template,
            content: change === 'different content' ? 'Changed text.' : content,
          } as unknown as EventTemplate,
          change === 'different key' ? new Uint8Array(32).fill(8) : author,
        ),
      }));
      await expect(signNostrTextNote(content)).rejects.toThrow(
        'valid signature',
      );
    },
  );
});

describe('NIP-09 deletion', () => {
  const author = new Uint8Array(32).fill(7);
  const publicKey = getPublicKey(author);
  const note = {
    id,
    content: 'A fictional note.',
    npub: npubEncode(publicKey),
    publishedAt: '2026-11-01T12:00:00.000Z',
  };
  const signEvent = async (template: Record<string, unknown>) => ({
    ...finalizeEvent(template as unknown as EventTemplate, author),
  });

  beforeEach(() => {
    window.nostr = { getPublicKey: async () => publicKey, signEvent };
  });
  afterEach(() => delete window.nostr);

  it('publishes the author-signed deletion when at least one relay accepts', async () => {
    publish.mockImplementation(() => [
      Promise.resolve('ok'),
      Promise.reject(new Error('Offline')),
    ]);
    const signed = await publishNostrNoteDeletion(note);
    expect(signed).toMatchObject({
      kind: 5,
      pubkey: publicKey,
      tags: [
        ['e', note.id],
        ['k', '1'],
      ],
      content: '',
    });
    expect(publish).toHaveBeenCalledWith(FEATURED_NOTE_RELAYS, signed, {
      maxWait: 5000,
    });
    expect(destroy).toHaveBeenCalledTimes(1);
    const post = jest.spyOn(http, 'post').mockResolvedValue({});
    await recordNostrNoteDeletion(note.id, signed);
    expect(post).toHaveBeenCalledWith(
      `/api/admin/nostr/featured-notes/${id}/deletion`,
      { event: signed },
    );
  });

  it.each([undefined, { getPublicKey: async () => publicKey }])(
    'requires a signer with both NIP-07 methods',
    async signer => {
      window.nostr = signer;
      await expect(publishNostrNoteDeletion(note)).rejects.toThrow(
        'Connect a Nostr browser signer',
      );
      expect(publish).not.toHaveBeenCalled();
    },
  );

  it.each([npubEncode(id), noteEncode(id)])(
    'requires the note author key',
    async npub => {
      await expect(publishNostrNoteDeletion({ ...note, npub })).rejects.toThrow(
        'The signer must use the key',
      );
      expect(publish).not.toHaveBeenCalled();
    },
  );

  it('rejects a signature for a modified event', async () => {
    window.nostr!.signEvent = async template => ({
      ...finalizeEvent(
        { ...template, content: 'Modified' } as unknown as EventTemplate,
        author,
      ),
    });
    await expect(publishNostrNoteDeletion(note)).rejects.toThrow(
      'The signer did not return a valid deletion request.',
    );
    expect(publish).not.toHaveBeenCalled();
  });

  it('reports when all relays reject the request and closes connections', async () => {
    publish.mockImplementation(() => [Promise.reject(new Error('Offline'))]);
    await expect(publishNostrNoteDeletion(note)).rejects.toThrow(
      'No relay acknowledged',
    );
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
