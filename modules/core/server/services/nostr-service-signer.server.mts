import {
  finalizeEvent,
  getPublicKey,
  type EventTemplate,
} from 'nostr-tools/pure';
import { decode } from 'nostr-tools/nip19';

export const trustrootsNostrServiceName = '_';
export const trustrootsNostrServiceIdentifier = '_@trustroots.org';

export function getNostrServiceSigner() {
  const encoded =
    process.env.TRUSTROOTS_NOSTR_SERVICE_NSEC ??
    process.env.TRUSTROOTS_NOSTR_EXPORT_NSEC;
  if (!encoded) return undefined;

  try {
    const key = decode(encoded);
    if (key.type !== 'nsec') return undefined;
    const publicKey = getPublicKey(key.data);
    return {
      publicKey,
      sign: (event: EventTemplate) => finalizeEvent(event, key.data),
    };
  } catch {
    return undefined;
  }
}
