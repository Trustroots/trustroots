import {
  verifyEvent,
  type Event,
  type EventTemplate,
  type Filter,
} from 'nostr-tools';
import { decode, npubEncode } from 'nostr-tools/nip19';
import { SimplePool } from 'nostr-tools/pool';
import http from '@/modules/core/client/api/http-client';
import {
  FEATURED_NOTE_PUBLISH_RELAYS,
  FEATURED_NOTE_RELAYS,
  FEATURED_ARTICLE_KIND,
  type FeaturedNostrNote,
} from '@/modules/core/shared/featured-nostr-notes.mts';

function readNoteFilter(reference: string): Filter | undefined {
  try {
    let code = reference.trim().replace(/^nostr:/i, '');
    if (/^https?:\/\//i.test(code)) {
      code = new URL(code).pathname.split('/').filter(Boolean).pop() ?? '';
    }
    if (/^[0-9a-f]{64}$/i.test(code))
      return { ids: [code.toLowerCase()], kinds: [1, FEATURED_ARTICLE_KIND] };

    const decoded = decode(code);
    if (decoded.type === 'note')
      return { ids: [decoded.data], kinds: [1, FEATURED_ARTICLE_KIND] };
    if (decoded.type === 'nevent')
      return { ids: [decoded.data.id], kinds: [1, FEATURED_ARTICLE_KIND] };
    if (
      decoded.type === 'naddr' &&
      decoded.data.kind === FEATURED_ARTICLE_KIND
    ) {
      return {
        kinds: [FEATURED_ARTICLE_KIND],
        authors: [decoded.data.pubkey],
        '#d': [decoded.data.identifier],
      };
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export async function featureNostrNote(reference: string) {
  const filter = readNoteFilter(reference);
  if (!filter) throw new Error('Enter a Nostr note link or event ID.');

  const pool = new SimplePool();
  try {
    const event = await pool.get(FEATURED_NOTE_RELAYS, filter, {
      maxWait: 5000,
    });
    if (!event) {
      throw new Error('Could not find that text note on the supported relays.');
    }
    return await featureSignedNostrNote(event);
  } finally {
    pool.destroy();
  }
}

export async function featureSignedNostrNote(event: Event) {
  const { data } = await http.post<FeaturedNostrNote>(
    '/api/admin/nostr/featured-notes',
    { event },
    { expectedStatuses: [400, 409] },
  );
  return data;
}

export async function signNostrTextNote(
  content: string,
  note?: FeaturedNostrNote,
): Promise<Event> {
  if (!content.trim()) throw new Error('Enter a note to publish.');
  if (new TextEncoder().encode(content).length > 32768) {
    throw new Error('The note must be 32 KiB or smaller.');
  }

  const signer = window.nostr;
  if (!signer?.getPublicKey || !signer.signEvent) {
    throw new Error('Connect a NIP-07 browser signer to publish a note.');
  }
  const pubkey = (await signer.getPublicKey()).toLowerCase();
  if (note && note.npub !== npubEncode(pubkey)) {
    throw new Error('The signer must use the key that published this note.');
  }
  const createdAt = Math.max(
    Math.floor(Date.now() / 1000),
    note?.article ? note.article.createdAt + 1 : 0,
    note ? Math.floor(Date.parse(note.publishedAt) / 1000) : 0,
  );
  const template = {
    kind: FEATURED_ARTICLE_KIND,
    created_at: createdAt,
    tags: [
      ['d', note?.article?.identifier ?? note?.id ?? crypto.randomUUID()],
      [
        'published_at',
        note
          ? String(Math.floor(Date.parse(note.publishedAt) / 1000))
          : String(createdAt),
      ],
    ],
    content,
  };
  return signVerifiedEvent(
    signer,
    pubkey,
    template,
    'The signer did not return a valid signature for this note.',
  );
}

async function signVerifiedEvent(
  signer: NonNullable<Window['nostr']>,
  pubkey: string,
  template: EventTemplate,
  error: string,
) {
  const { id, sig } = await signer.signEvent!({
    ...template,
    tags: template.tags.map(tag => [...tag]),
  });
  const event: Event = {
    ...template,
    pubkey,
    id: id as string,
    sig: sig as string,
  };
  if (!verifyEvent(event)) {
    throw new Error(error);
  }
  return event;
}

export async function publishNostrTextNote(event: Event) {
  return publishToRelays(
    FEATURED_NOTE_PUBLISH_RELAYS,
    event,
    'Neither relay acknowledged publication. Try again.',
  );
}

export async function removeFeaturedNostrNote(id: string) {
  await http.delete(`/api/admin/nostr/featured-notes/${id}`);
}

export async function reviseFeaturedNostrNote(id: string, event: Event) {
  const { data } = await http.put<FeaturedNostrNote>(
    `/api/admin/nostr/featured-notes/${id}`,
    { event },
    { expectedStatuses: [400, 404, 409] },
  );
  return data;
}

export async function publishNostrNoteDeletion(
  note: FeaturedNostrNote,
): Promise<Event> {
  const signer = window.nostr;
  if (!signer?.getPublicKey || !signer.signEvent) {
    throw new Error('Connect a Nostr browser signer to request deletion.');
  }
  const author = decode(note.npub);
  const pubkey = (await signer.getPublicKey()).toLowerCase();
  if (author.type !== 'npub' || author.data !== pubkey) {
    throw new Error('The signer must use the key that published this note.');
  }
  const template: EventTemplate = {
    kind: 5,
    created_at: Math.max(
      Math.floor(Date.now() / 1000),
      note.article?.createdAt ?? 0,
    ),
    tags: note.article
      ? [
          [
            'a',
            `${FEATURED_ARTICLE_KIND}:${pubkey}:${note.article.identifier}`,
          ],
          ['e', note.article.eventId],
          ['k', String(FEATURED_ARTICLE_KIND)],
        ]
      : [
          ['e', note.id],
          ['k', '1'],
        ],
    content: '',
  };
  const event = await signVerifiedEvent(
    signer,
    pubkey,
    template,
    'The signer did not return a valid deletion request.',
  );

  await publishToRelays(
    FEATURED_NOTE_RELAYS,
    event,
    'No relay acknowledged the deletion request.',
  );
  return event;
}

async function publishToRelays(
  relays: string[],
  event: Event,
  failureMessage: string,
) {
  const pool = new SimplePool();
  try {
    const results = await Promise.allSettled(
      pool.publish(relays, event, { maxWait: 5000 }),
    );
    const acknowledgedRelays = results.flatMap((result, index) =>
      result.status === 'fulfilled' ? [relays[index]] : [],
    );
    if (!acknowledgedRelays.length) {
      throw new Error(failureMessage);
    }
    return acknowledgedRelays;
  } finally {
    pool.destroy();
  }
}

export async function recordNostrNoteDeletion(id: string, event: Event) {
  await http.post(`/api/admin/nostr/featured-notes/${id}/deletion`, { event });
}
