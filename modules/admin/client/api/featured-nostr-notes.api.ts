import { verifyEvent, type Event } from 'nostr-tools';
import { decode } from 'nostr-tools/nip19';
import { SimplePool } from 'nostr-tools/pool';
import http from '@/modules/core/client/api/http-client';
import {
  FEATURED_NOTE_PUBLISH_RELAY,
  FEATURED_NOTE_RELAYS,
  type FeaturedNostrNote,
} from '@/modules/core/shared/featured-nostr-notes.mts';

function readEventId(reference: string) {
  try {
    let code = reference.trim().replace(/^nostr:/i, '');
    if (/^https?:\/\//i.test(code)) {
      code = new URL(code).pathname.split('/').filter(Boolean).pop() ?? '';
    }
    if (/^[0-9a-f]{64}$/i.test(code)) return code.toLowerCase();

    const decoded = decode(code);
    if (decoded.type === 'note') return decoded.data;
    if (decoded.type === 'nevent') return decoded.data.id;
  } catch {
    return undefined;
  }
  return undefined;
}

export async function featureNostrNote(reference: string) {
  const id = readEventId(reference);
  if (!id) throw new Error('Enter a Nostr note link or event ID.');

  const pool = new SimplePool();
  try {
    const event = await pool.get(
      FEATURED_NOTE_RELAYS,
      { ids: [id], kinds: [1] },
      { maxWait: 5000 },
    );
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

export async function signNostrTextNote(content: string): Promise<Event> {
  if (!content.trim()) throw new Error('Enter a note to publish.');
  if (new TextEncoder().encode(content).length > 32768) {
    throw new Error('The note must be 32 KiB or smaller.');
  }

  const signer = window.nostr;
  if (!signer?.getPublicKey || !signer.signEvent) {
    throw new Error('Connect a NIP-07 browser signer to publish a note.');
  }
  const pubkey = (await signer.getPublicKey()).toLowerCase();
  const template = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [],
    content,
  };
  const { id, sig } = await signer.signEvent({ ...template, tags: [] });
  const event: Event = {
    ...template,
    pubkey,
    id: id as string,
    sig: sig as string,
  };
  if (!verifyEvent(event)) {
    throw new Error(
      'The signer did not return a valid signature for this note.',
    );
  }
  return event;
}

export async function publishNostrTextNote(event: Event) {
  await publishToRelays(
    [FEATURED_NOTE_PUBLISH_RELAY],
    event,
    `${FEATURED_NOTE_PUBLISH_RELAY} did not acknowledge publication. Try again.`,
  );
}

export async function removeFeaturedNostrNote(id: string) {
  await http.delete(`/api/admin/nostr/featured-notes/${id}`);
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
  const template = {
    kind: 5,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['e', note.id],
      ['k', '1'],
    ],
    content: '',
  };
  const { id, sig } = await signer.signEvent({
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
    throw new Error('The signer did not return a valid deletion request.');
  }

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
    if (!results.some(result => result.status === 'fulfilled')) {
      throw new Error(failureMessage);
    }
  } finally {
    pool.destroy();
  }
}

export async function recordNostrNoteDeletion(id: string, event: Event) {
  await http.post(`/api/admin/nostr/featured-notes/${id}/deletion`, { event });
}
