import type { EventTemplate, VerifiedEvent } from 'nostr-tools';
import { Relay } from 'nostr-tools/relay';

const AUTHENTICATED_NOSTR_RELAY = 'wss://nip42.trustroots.org';

export async function withAuthenticatedNostrRelay<T>(
  sign: (event: EventTemplate) => Promise<VerifiedEvent>,
  run: (relay: Relay) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  const relay = new Relay(AUTHENTICATED_NOSTR_RELAY, {
    enableReconnect: false,
  });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const challenge = new Promise<void>((resolve, reject) => {
    timeout = setTimeout(
      () =>
        reject(
          new Error(
            'The Nostr relay did not send an authentication challenge.',
          ),
        ),
      8_000,
    );
    relay.onauth = event => {
      resolve();
      return sign(event);
    };
  });
  let abort: () => void;
  const interrupted = new Promise<never>((_, reject) => {
    abort = () => reject(signal?.reason);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
  try {
    return await Promise.race([
      interrupted,
      (async () => {
        await Promise.all([
          relay.connect({ timeout: 5_000, abort: signal }),
          challenge,
        ]);
        signal?.throwIfAborted();
        // The challenge handler starts authentication. Wait for its relay ACK.
        await relay.auth(sign);
        signal?.throwIfAborted();
        return run(relay);
      })(),
    ]);
  } finally {
    signal?.removeEventListener('abort', abort!);
    clearTimeout(timeout);
    relay.close();
  }
}
