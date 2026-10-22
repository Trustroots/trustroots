import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { BunkerSigner, createNostrConnectURI } from 'nostr-tools/nip46';
import type { EventTemplate } from 'nostr-tools';

export interface Signer {
  getPublicKey(): Promise<string>;
  signEvent(event: EventTemplate): Promise<unknown>;
  close?(): Promise<void>;
}

export function browserSigner(): Signer {
  const signer = (window as Window & { nostr?: Signer }).nostr;
  if (!signer?.getPublicKey || !signer.signEvent)
    throw new Error(
      'Install or enable a Nostr browser signer, or connect a remote signer.',
    );
  return signer;
}

export async function bunkerSigner(input: string): Promise<Signer> {
  const url = new URL(input);
  if (url.protocol !== 'bunker:' || !/^[a-f0-9]{64}$/i.test(url.hostname))
    throw new Error('Enter a valid bunker:// connection URL.');
  const relays = url.searchParams.getAll('relay');
  if (
    !relays.length ||
    relays.some(relay => new URL(relay).protocol !== 'wss:')
  )
    throw new Error('The remote signer needs a secure relay URL.');
  const signer = BunkerSigner.fromBunker(generateSecretKey(), {
    pubkey: url.hostname,
    relays,
    secret: url.searchParams.get('secret'),
  });
  try {
    await signer.connect({
      name: 'Trustroots Nostranslation',
      url: 'https://team.trustroots.org/nostranslation',
    });
  } catch (error) {
    await signer.close();
    throw error;
  }
  return signer;
}

export function remoteConnection(signal: AbortSignal) {
  const secretKey = generateSecretKey();
  const uri = createNostrConnectURI({
    clientPubkey: getPublicKey(secretKey),
    relays: ['wss://relay.trustroots.org'],
    secret: crypto.randomUUID(),
    perms: ['sign_event:27235'],
    name: 'Trustroots Nostranslation',
    url: 'https://team.trustroots.org/nostranslation',
  });
  return {
    uri,
    connect: () => BunkerSigner.fromURI(secretKey, uri, {}, signal),
  };
}

export async function authorisation(signer: Signer, url: string, body: string) {
  const bytes = new TextEncoder().encode(body);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const payload = [...new Uint8Array(hash)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
  const event = await signer.signEvent({
    kind: 27235,
    created_at: Math.floor(Date.now() / 1000),
    content: '',
    tags: [
      ['u', url],
      ['method', 'POST'],
      ['payload', payload],
    ],
  });
  return 'Nostr ' + btoa(JSON.stringify(event));
}
