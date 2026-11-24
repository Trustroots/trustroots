import type { EventTemplate, VerifiedEvent } from 'nostr-tools';
import { Relay } from 'nostr-tools/relay';
import { CIRCLE_CHAT_RELAY } from './circle-chat.ts';

export async function withCircleChatRelay<T>(
  sign: (event: EventTemplate) => Promise<VerifiedEvent>,
  run: (relay: Relay) => Promise<T>,
): Promise<T> {
  const relay = new Relay(CIRCLE_CHAT_RELAY);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const challenge = new Promise<void>((resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error('Circle chat relay did not challenge')),
      8_000,
    );
    relay.onauth = event => {
      resolve();
      return sign(event);
    };
  });
  try {
    await Promise.all([relay.connect({ timeout: 5_000 }), challenge]);
    // The challenge handler starts authentication. Wait for its relay ACK.
    await relay.auth(sign);
    return await run(relay);
  } finally {
    clearTimeout(timeout);
    relay.close();
  }
}
