import {
  nip19,
  sortEvents,
  verifyEvent,
  type Event,
  type EventTemplate,
  type VerifiedEvent,
} from 'nostr-tools';
import { Relay } from 'nostr-tools/relay';
import http from '../../../core/client/api/http-client.ts';
import { withAuthenticatedNostrRelay } from '../../../core/shared/nostr-authenticated-relay.mts';
import type { NostrEventSigner } from './nostr-proof.client';

const PUBLIC_RELAY = 'wss://relay.trustroots.org';
const METADATA_LOOKUP_TIMEOUT = 5_000;

async function readMetadata(relay: Relay, pubkey: string) {
  const events: Event[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let subscription: ReturnType<Relay['subscribe']> | undefined;
  try {
    return await new Promise<Event | undefined>((resolve, reject) => {
      timer = setTimeout(
        () => reject(new Error('Nostr metadata lookup timed out.')),
        METADATA_LOOKUP_TIMEOUT,
      );
      subscription = relay.subscribe(
        [{ kinds: [0], authors: [pubkey], limit: 1 }],
        {
          onevent: event => events.push(event),
          oneose: () => resolve(sortEvents(events)[0]),
          onclose: reason => reject(new Error(reason)),
          // The relay library also synthesises EOSE on timeout. Require real EOSE.
          eoseTimeout: METADATA_LOOKUP_TIMEOUT * 2,
        },
      );
    });
  } finally {
    clearTimeout(timer);
    subscription?.close();
  }
}

async function readPublicMetadata(pubkey: string, signal: AbortSignal) {
  const relay = new Relay(PUBLIC_RELAY, { enableReconnect: false });
  try {
    await relay.connect({ timeout: METADATA_LOOKUP_TIMEOUT, abort: signal });
    return await readMetadata(relay, pubkey);
  } finally {
    relay.close();
  }
}

export async function publishNostrProfile(
  user: { username: string; nostrNpub: string },
  signEvent: NostrEventSigner,
  signal: AbortSignal,
) {
  const key = nip19.decode(user.nostrNpub);
  if (key.type !== 'npub') throw new Error('Expected a Nostr public key.');
  const username = user.username.toLowerCase();
  const { data } = await http.get<{ names: Record<string, string> }>(
    '/.well-known/nostr.json',
    { params: { name: username }, signal, timeout: METADATA_LOOKUP_TIMEOUT },
  );
  if (data.names[username] !== key.data) return 'unavailable';

  async function sign(template: EventTemplate): Promise<VerifiedEvent> {
    signal.throwIfAborted();
    // Copy the template and verify the exact wire fields returned by the signer.
    const signed = (await signEvent({
      ...template,
      tags: template.tags.map(tag => [...tag]),
    })) as Event;
    signal.throwIfAborted();
    const { id, pubkey, kind, created_at, tags, content, sig } = signed;
    const event = { id, pubkey, kind, created_at, tags, content, sig };
    if (
      pubkey !== key.data ||
      kind !== template.kind ||
      created_at !== template.created_at ||
      content !== template.content ||
      JSON.stringify(tags) !== JSON.stringify(template.tags) ||
      !verifyEvent(event)
    ) {
      throw new Error('The signer returned an unexpected Nostr event.');
    }
    return event;
  }

  await withAuthenticatedNostrRelay(
    sign,
    async relay => {
      const [stored, publicMetadata] = await Promise.all([
        readMetadata(relay, key.data),
        readPublicMetadata(key.data, signal),
      ]);
      const latest = sortEvents(
        [stored, publicMetadata].filter(event => event !== undefined),
      )[0];
      const nip05 = `${username}@trustroots.org`;
      const metadata: unknown = latest ? JSON.parse(latest.content) : {};
      if (
        !metadata ||
        typeof metadata !== 'object' ||
        Array.isArray(metadata)
      ) {
        throw new Error('Existing Nostr metadata is invalid.');
      }
      if (
        stored &&
        latest.id === stored.id &&
        'nip05' in metadata &&
        metadata.nip05 === nip05
      )
        return;

      const now = Math.floor(Date.now() / 1000);
      if (latest && latest.created_at > now) {
        throw new Error('Existing Nostr metadata is dated in the future.');
      }
      const event = await sign({
        kind: 0,
        content: JSON.stringify({ ...metadata, nip05 }),
        created_at: Math.max(now, latest ? latest.created_at + 1 : now),
        tags: latest?.tags ?? [],
      });
      await relay.publish(event);
    },
    signal,
  );
  return 'published';
}
