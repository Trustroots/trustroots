import {
  generateSecretKey,
  nip19,
  SimplePool,
  type EventTemplate,
} from 'nostr-tools';

export class NostrSigningError extends Error {}

export async function signNostrProof(
  event: EventTemplate,
  npub: string,
  method: 'browser' | 'bunker',
  bunkerUri: string,
  onAuth: (url: string) => void,
  signal: AbortSignal,
): Promise<unknown> {
  const decoded = nip19.decode(npub);
  if (decoded.type !== 'npub')
    throw new NostrSigningError('Please provide a valid npub.');
  const pubkey = decoded.data;
  let close = async () => {};
  let stopped = false;
  const checkActive = () => {
    if (stopped || signal.aborted)
      throw new NostrSigningError('Nostr signing was cancelled.');
  };
  let timer: ReturnType<typeof setTimeout>;
  let rejectAbort: () => void;
  let rejectOperation: (error: Error) => void;
  const interrupted = new Promise<never>((_, reject) => {
    rejectOperation = reject;
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
    const work = async () => {
      checkActive();
      if (method === 'browser') {
        const signer = window.nostr;
        if (!signer?.getPublicKey || !signer.signEvent)
          throw new NostrSigningError(
            'Connect a browser Nostr signer or choose another signing method.',
          );
        const signerPubkey = await signer.getPublicKey();
        checkActive();
        if (signerPubkey !== pubkey)
          throw new NostrSigningError(
            'The signer public key does not match this npub.',
          );
        return signer.signEvent({ ...event });
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
          onauth: url => {
            try {
              checkActive();
              if (new URL(url).protocol !== 'https:')
                throw new NostrSigningError('Invalid URL');
              onAuth(url);
            } catch {
              rejectOperation(
                new NostrSigningError(
                  'The signer returned an invalid authorisation URL.',
                ),
              );
            }
          },
          skipSwitchRelays: true,
        },
      );
      close = async () => {
        try {
          await signer.close();
        } finally {
          pool.destroy();
        }
      };
      await signer.connect({ name: 'Trustroots', url: window.location.origin });
      checkActive();
      const signerPubkey = await signer.getPublicKey();
      checkActive();
      if (signerPubkey !== pubkey)
        throw new NostrSigningError(
          'The signer public key does not match this npub.',
        );
      return signer.signEvent(event);
    };
    return await Promise.race([work(), interrupted]);
  } finally {
    stopped = true;
    clearTimeout(timer!);
    signal.removeEventListener('abort', rejectAbort!);
    await close();
  }
}
