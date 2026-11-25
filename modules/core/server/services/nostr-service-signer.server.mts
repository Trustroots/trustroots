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
  // Stryker disable next-line ConditionalExpression: skipping the guard also yields undefined because decode rejects a missing or empty value
  if (!encoded) return undefined;

  try {
    const key = decode(encoded);
    // Stryker disable next-line ConditionalExpression: non-nsec decodings contain no secret bytes, so getPublicKey would reject them
    if (key.type !== 'nsec') return undefined;
    const publicKey = getPublicKey(key.data);
    return {
      publicKey,
      sign: (event: EventTemplate) => finalizeEvent(event, key.data),
    };
  } catch {
    // Invalid encodings and invalid secret scalars leave the signer unavailable.
  }
}
