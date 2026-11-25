import {
  generateSecretKey,
  getPublicKey,
  nip19,
  SimplePool,
  type EventTemplate,
} from 'nostr-tools';

export class NostrSigningError extends Error {}

export type NostrEventSigner = (event: EventTemplate) => Promise<unknown>;
type LinkProof = { npub: string; proof: unknown };
type CompleteLink = (link: LinkProof, sign: NostrEventSigner) => Promise<void>;

function activeSigner(
  sign: NostrEventSigner,
  checkActive: () => void,
): NostrEventSigner {
  return async event => {
    checkActive();
    const signed = await sign(event);
    checkActive();
    return signed;
  };
}

function browserSigner() {
  const signer = window.nostr;
  if (
    typeof signer?.getPublicKey === 'function' &&
    typeof signer.signEvent === 'function'
  ) {
    return signer as Required<NonNullable<Window['nostr']>>;
  }
}

export function hasBrowserNostrSigner() {
  return Boolean(browserSigner());
}

function requireBrowserSigner() {
  const signer = browserSigner();
  if (!signer)
    throw new NostrSigningError(
      'Connect a browser Nostr signer or choose another signing method.',
    );
  return signer;
}

async function runNostrSigning<T>(
  signal: AbortSignal,
  onAuth: (url: string) => void,
  work: (controls: {
    checkActive: () => void;
    setCleanup: (cleanup: () => Promise<void>) => void;
    authorise: (url: string) => void;
  }) => Promise<T>,
): Promise<T> {
  let close = async () => {};
  let stopped = false;
  const checkActive = () => {
    if (stopped || signal.aborted)
      throw new NostrSigningError('Nostr signing was cancelled.');
  };
  let timer: ReturnType<typeof setTimeout>;
  let rejectAbort: () => void;
  let fail: (error: Error) => void;
  const interrupted = new Promise<never>((_, reject) => {
    fail = reject;
    rejectAbort = () =>
      reject(new NostrSigningError('Nostr signing was cancelled.'));
    signal.addEventListener('abort', rejectAbort, { once: true });
    if (signal.aborted) rejectAbort();
    timer = setTimeout(
      () =>
        reject(
          new NostrSigningError('Nostr signing timed out. Please try again.'),
        ),
      120_000,
    );
  });
  try {
    return await Promise.race([
      work({
        checkActive,
        authorise: url => {
          try {
            checkActive();
            if (new URL(url).protocol !== 'https:')
              throw new Error('Invalid URL');
            onAuth(url);
          } catch {
            fail(
              new NostrSigningError(
                'The signer returned an invalid authorisation URL.',
              ),
            );
          }
        },
        setCleanup: cleanup => {
          close = cleanup;
        },
      }),
      interrupted,
    ]);
  } finally {
    stopped = true;
    clearTimeout(timer!);
    signal.removeEventListener('abort', rejectAbort!);
    await close();
  }
}

export async function signNostrProof(
  event: EventTemplate,
  npub: string,
  method: 'browser' | 'bunker',
  bunkerUri: string,
  onAuth: (url: string) => void,
  signal: AbortSignal,
  complete?: CompleteLink,
): Promise<unknown> {
  const decoded = nip19.decode(npub);
  if (decoded.type !== 'npub')
    throw new NostrSigningError('Please provide a valid npub.');
  const pubkey = decoded.data;
  return runNostrSigning(
    signal,
    onAuth,
    async ({ checkActive, setCleanup, authorise }) => {
      checkActive();
      async function prove(signEvent: NostrEventSigner) {
        const sign = activeSigner(signEvent, checkActive);
        const proof = await sign(event);
        await complete?.({ npub, proof }, sign);
        return proof;
      }
      if (method === 'browser') {
        const signer = requireBrowserSigner();
        const signerPubkey = await signer.getPublicKey();
        checkActive();
        if (signerPubkey !== pubkey)
          throw new NostrSigningError(
            'The signer public key does not match this npub.',
          );
        return prove(template => signer.signEvent({ ...template }));
      }
      const uri = new URL(bunkerUri.trim());
      const relays = uri.searchParams.getAll('relay');
      if (
        uri.protocol !== 'bunker:' ||
        !/^[0-9a-f]{64}$/.test(uri.hostname) ||
        !relays.length ||
        relays.length > 8
      ) {
        throw new NostrSigningError(
          'Enter a bunker:// URI with a public key and secure relay addresses.',
        );
      }
      for (const relay of relays) {
        const url = new URL(relay);
        if (url.protocol !== 'wss:' || url.username || url.password || url.hash)
          throw new NostrSigningError('Use secure wss:// relay addresses.');
      }
      const { BunkerSigner } = await import('nostr-tools/nip46');
      checkActive();
      const pool = new SimplePool({ enableReconnect: false });
      const signer = BunkerSigner.fromBunker(
        generateSecretKey(),
        {
          pubkey: uri.hostname,
          relays,
          secret: uri.searchParams.get('secret'),
        },
        {
          pool,
          onauth: authorise,
          skipSwitchRelays: true,
        },
      );
      setCleanup(async () => {
        try {
          await signer.close();
        } finally {
          pool.destroy();
        }
      });
      await signer.connect({ name: 'Trustroots', url: window.location.origin });
      checkActive();
      const signerPubkey = await signer.getPublicKey();
      checkActive();
      if (signerPubkey !== pubkey)
        throw new NostrSigningError(
          'The signer public key does not match this npub.',
        );
      return prove(template => signer.signEvent(template));
    },
  );
}

export async function withConnectedNostr<T>(
  method: 'browser' | 'pair',
  onPairing: (connection: { uri: string; qr: string } | undefined) => void,
  onAuth: (url: string) => void,
  signal: AbortSignal,
  work: (npub: string, sign: NostrEventSigner) => Promise<T>,
) {
  return runNostrSigning(
    signal,
    onAuth,
    async ({ checkActive, setCleanup, authorise }) => {
      checkActive();
      let signer: {
        getPublicKey: () => Promise<string>;
        signEvent: (event: EventTemplate) => Promise<unknown>;
      };
      if (method === 'browser') {
        const extension = requireBrowserSigner();
        signer = {
          getPublicKey: () => extension.getPublicKey(),
          signEvent: event => extension.signEvent({ ...event }),
        };
      } else {
        const [{ BunkerSigner, createNostrConnectURI }, { default: QRCode }] =
          await Promise.all([import('nostr-tools/nip46'), import('qrcode')]);
        checkActive();
        const key = generateSecretKey();
        const uri = createNostrConnectURI({
          clientPubkey: getPublicKey(key),
          relays: ['wss://relay.trustroots.org'],
          secret: crypto.randomUUID(),
          perms: ['sign_event:27235', 'sign_event:22242', 'sign_event:0'],
          name: 'Trustroots',
          url: window.location.origin,
        });
        const qr = await QRCode.toDataURL(uri, { width: 240 });
        checkActive();
        const pool = new SimplePool({ enableReconnect: false });
        setCleanup(async () => pool.destroy());
        const connection = BunkerSigner.fromURI(
          key,
          uri,
          { pool, skipSwitchRelays: true, onauth: authorise },
          signal,
        );
        onPairing({ uri, qr });
        const remote = await connection;
        checkActive();
        setCleanup(async () => {
          try {
            await remote.close();
          } finally {
            pool.destroy();
          }
        });
        onPairing(undefined);
        signer = remote;
      }

      const npub = nip19.npubEncode(await signer.getPublicKey());
      checkActive();
      return work(
        npub,
        activeSigner(event => signer.signEvent(event), checkActive),
      );
    },
  );
}

export async function signWithConnectedNostr(
  method: 'browser' | 'pair',
  requestChallenge: (npub: string) => Promise<EventTemplate>,
  onPairing: (connection: { uri: string; qr: string } | undefined) => void,
  onAuth: (url: string) => void,
  signal: AbortSignal,
  complete?: CompleteLink,
) {
  return withConnectedNostr(
    method,
    onPairing,
    onAuth,
    signal,
    async (npub, sign) => {
      const proof = await sign(await requestChallenge(npub));
      const link = { npub, proof };
      await complete?.(link, sign);
      return link;
    },
  );
}
