/**
 * Signs the member data export with a Nostr key.
 *
 * The signature is detached: it covers the canonical digests of the export
 * payload (see `data-export-canonical.server.service`) and is delivered
 * alongside that payload rather than inside it, so nothing has to be punched
 * out of the document before verification.
 *
 * Signatures use the Trustroots Nostr service identity. See
 * `docs/data-export-signing.md` for key distribution.
 */

import { getNostrServiceSigner } from '../../../core/server/services/nostr-service-signer.server.mts';
import * as canonical from './data-export-canonical.server.service.mts';

/**
 * @returns {object|null} a detached signature, or `null` when no usable
 *   signing key is configured. An unsigned export is a degraded export, not a
 *   failed one.
 */
function signPayload(
  payload: canonical.SignedPayload,
  { username, now }: { username?: string; now?: Date } = {},
) {
  const signer = getNostrServiceSigner();

  if (!signer) {
    return null;
  }

  const { sections, root } = canonical.digestPayload(payload);
  const createdAt = Math.floor((now ? now.getTime() : Date.now()) / 1000);

  const event = signer.sign({
    kind: canonical.ATTESTATION_KIND,
    created_at: createdAt,
    tags: [
      ['x', root],
      ['m', 'application/json'],
      ['d', username || ''],
      ['alt', 'Trustroots member data export attestation'],
    ],
    content: '',
  });

  return {
    alg: canonical.SIGNATURE_ALGORITHM,
    signed: ['format', 'version', ...canonical.SECTION_NAMES],
    sections,
    root,
    event,
  };
}

export { signPayload };
