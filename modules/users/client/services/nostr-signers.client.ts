import {
  BUNKER_REGEX,
  BunkerSigner,
  createNostrConnectURI,
  parseBunkerInput,
  type BunkerPointer,
} from 'nostr-tools/nip46'; // eslint-disable-line import/no-unresolved -- exposed via package exports.
import { generateSecretKey, getPublicKey, SimplePool } from 'nostr-tools';

export const DEFAULT_NOSTR_RELAY = 'wss://relay.trustroots.org';
export const NOSTR_SIGNER_TIMEOUT_MS = 120_000;

export interface UnsignedNostrEvent {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
}

export interface SignedNostrEvent extends UnsignedNostrEvent {
  id: string;
  pubkey: string;
  sig: string;
}

export interface NostrSigner {
  getPublicKey(): Promise<string>;
  signEvent(event: UnsignedNostrEvent): Promise<SignedNostrEvent>;
  close(): Promise<void>;
}

export interface NostrExtension {
  getPublicKey?: () => Promise<string>;
  signEvent?: (event: UnsignedNostrEvent) => Promise<SignedNostrEvent>;
}

declare global {
  interface Window {
    nostr?: NostrExtension;
  }
}

export function validateNostrRelay(value: string): string {
  const trimmed = value.trim();
  const relay = new URL(trimmed);
  if (
    relay.protocol !== 'wss:' ||
    !relay.hostname ||
    relay.username ||
    relay.password ||
    relay.hash
  ) {
    throw new Error('Enter a secure wss:// relay address.');
  }
  return relay.toString().replace(/\/$/, '');
}

export function validateNostrRelays(values: string[]): string[] {
  if (values.length === 0 || values.length > 8) {
    throw new Error('Choose between one and eight secure relay addresses.');
  }
  return [...new Set(values.map(validateNostrRelay))];
}

export class ValidatingNostrPool extends SimplePool {
  private allowedRelays: Set<string>;

  constructor(relays: string[]) {
    super({ enableReconnect: false });
    this.allowedRelays = new Set(relays);
  }

  allow(relays: string[]) {
    this.allowedRelays = new Set(relays);
  }

  override async ensureRelay(
    url: string,
    params?: { connectionTimeout?: number; abort?: AbortSignal },
  ) {
    const relay = validateNostrRelay(url);
    if (!this.allowedRelays.has(relay)) {
      throw new Error('The NIP-46 signer requested an unapproved relay.');
    }
    return super.ensureRelay(relay, params);
  }
}

export function getNip07Signer(): NostrSigner | undefined {
  const extension = window.nostr;
  if (
    !extension ||
    typeof extension.getPublicKey !== 'function' ||
    typeof extension.signEvent !== 'function'
  ) {
    return undefined;
  }
  return {
    getPublicKey: () => extension.getPublicKey!(),
    signEvent: event => extension.signEvent!(event),
    close: async () => undefined,
  };
}

export function buildNostrConnectUri(relays: string[]): {
  uri: string;
  secretKey: Uint8Array;
} {
  const secretKey = generateSecretKey();
  const uri = createNostrConnectURI({
    clientPubkey: getPublicKey(secretKey),
    relays: validateNostrRelays(relays),
    secret: Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join(''),
    name: 'Trustroots profile editor',
    url: window.location.origin,
    perms: ['get_public_key', 'sign_event:27235'],
  });
  return { uri, secretKey };
}

function parseRelays(response: string): string[] {
  const relays: unknown = JSON.parse(response);
  if (
    !Array.isArray(relays) ||
    relays.some(relay => typeof relay !== 'string')
  ) {
    throw new Error('The signer returned invalid relay addresses.');
  }
  return validateNostrRelays(relays);
}

async function finaliseBunkerSigner(
  signer: BunkerSigner,
  pool: ValidatingNostrPool,
  connectFirst: boolean,
): Promise<NostrSigner> {
  if (connectFirst) {
    await signer.connect({
      name: 'Trustroots profile editor',
      url: window.location.origin,
    });
  }

  // Validate the signer's suggested relays before nostr-tools changes the
  // relay list and reconnects subscriptions.
  const sendRequest = signer.sendRequest.bind(signer);
  signer.sendRequest = async (method: string, params: string[]) => {
    if (method !== 'switch_relays') {
      return sendRequest(method, params);
    }
    const response = await sendRequest(method, params);
    try {
      const relays = parseRelays(response);
      pool.allow(relays);
      return JSON.stringify(relays);
    } catch {
      return 'false';
    }
  };
  await signer.switchRelays();

  return {
    getPublicKey: () => signer.getPublicKey(),
    signEvent: event => signer.signEvent(event),
    close: async () => {
      await signer.close();
      pool.destroy();
    },
  };
}

export async function connectBunkerSigner(
  input: string,
  relays: string[],
  onAuth: (url: string) => void,
  signal: AbortSignal,
): Promise<NostrSigner> {
  const bunkerUri = input.trim();
  if (
    /^bunker:\/\/[a-z0-9_-]+(?:\?|$)/i.test(bunkerUri) &&
    !/^bunker:\/\/[0-9a-f]{64}(?:\?|$)/i.test(bunkerUri)
  ) {
    throw new Error('The bunker URI must contain a valid public key.');
  }
  if (!BUNKER_REGEX.test(bunkerUri)) {
    throw new Error('Enter a valid bunker:// URI.');
  }
  const pointer = await parseBunkerInput(bunkerUri);
  if (!pointer || !/^[0-9a-f]{64}$/i.test(pointer.pubkey)) {
    throw new Error('The bunker URI must contain a valid public key.');
  }
  const pubkey = pointer.pubkey;
  const pointerRelays = pointer.relays;
  const configuredRelays = relays.length
    ? validateNostrRelays(relays)
    : validateNostrRelays(pointerRelays);
  const pool = new ValidatingNostrPool(configuredRelays);
  const bunkerPointer: BunkerPointer = {
    pubkey,
    secret: pointer.secret,
    relays: configuredRelays,
  };
  const signer = BunkerSigner.fromBunker(generateSecretKey(), bunkerPointer, {
    pool,
    onauth: onAuth,
    skipSwitchRelays: true,
  });
  const abortPromise = new Promise<never>((_, reject) => {
    if (signal.aborted) {
      reject(new Error('NIP-46 connection was cancelled.'));
      return;
    }
    signal.addEventListener(
      'abort',
      () => reject(new Error('NIP-46 connection was cancelled.')),
      { once: true },
    );
  });
  try {
    return await Promise.race([
      finaliseBunkerSigner(signer, pool, true),
      abortPromise,
    ]);
  } catch (error) {
    await signer.close();
    pool.destroy();
    throw error;
  }
}

export async function connectNostrConnectSigner(
  uri: string,
  secretKey: Uint8Array,
  onAuth: (url: string) => void,
  signal: AbortSignal,
): Promise<NostrSigner> {
  const parsed = new URL(uri);
  if (parsed.protocol !== 'nostrconnect:') {
    throw new Error('The generated Nostr Connect URI is invalid.');
  }
  const relays = validateNostrRelays(parsed.searchParams.getAll('relay'));
  const pool = new ValidatingNostrPool(relays);
  let signer: BunkerSigner | undefined;
  const abortPromise = new Promise<never>((_, reject) => {
    if (signal.aborted) {
      reject(new Error('NIP-46 connection was cancelled.'));
      return;
    }
    signal.addEventListener(
      'abort',
      () => reject(new Error('NIP-46 connection was cancelled.')),
      { once: true },
    );
  });
  try {
    const pendingSigner = BunkerSigner.fromURI(
      secretKey,
      uri,
      { pool, onauth: onAuth, skipSwitchRelays: true },
      signal,
    );
    signer = await Promise.race([pendingSigner, abortPromise]);
    return await Promise.race([
      finaliseBunkerSigner(signer, pool, false),
      abortPromise,
    ]);
  } catch (error) {
    await signer?.close();
    pool.destroy();
    throw error;
  }
}

export function buildNip55Uri(
  method: 'get_public_key' | 'sign_event',
  operationId: string,
  payload?: UnsignedNostrEvent,
  currentUser?: string,
): string {
  const callback = new URL('/profile/edit/networks', window.location.origin);
  callback.searchParams.set('nostrOperation', operationId);
  callback.searchParams.append('nostrResult', '');
  const request = payload ? JSON.stringify(payload) : '';
  const query = new URLSearchParams({
    type: method,
    callbackUrl: callback.toString(),
    compressionType: 'none',
  });
  if (currentUser) query.set('current_user', currentUser);
  if (method === 'sign_event') query.set('returnType', 'event');
  return `nostrsigner:${encodeURIComponent(request)}?${query.toString()}`;
}

export function parseNip55Result(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('The signer returned an empty result.');
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

export function isSignedNostrEvent(value: unknown): value is SignedNostrEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<SignedNostrEvent>;
  return (
    typeof event.id === 'string' &&
    typeof event.pubkey === 'string' &&
    typeof event.sig === 'string' &&
    typeof event.kind === 'number' &&
    typeof event.created_at === 'number' &&
    Array.isArray(event.tags) &&
    typeof event.content === 'string'
  );
}
