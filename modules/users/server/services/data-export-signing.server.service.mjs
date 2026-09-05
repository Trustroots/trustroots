/**
 * Signs the member data export with a Nostr key.
 *
 * The signature is detached: it covers the canonical digests of the export
 * payload (see `data-export-canonical.server.service`) and is delivered
 * alongside that payload rather than inside it, so nothing has to be punched
 * out of the document before verification.
 *
 * The key is a dedicated export-signing key. It is never the member's key and
 * never the nostroots server key, and its nsec is injected at runtime, never
 * committed. See `docs/data-export-signing.md`.
 */

import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';

import config from '../../../../config/config.mjs';
import log from '../../../../config/lib/logger.mjs';
import * as canonical from './data-export-canonical.server.service.mjs';

// Placeholder kind, pending an assignment in the nostroots `nr-common` kind
// registry. The attestation travels inside the exported file rather than to a
// relay, so replaceable-kind semantics never come into play.
const ATTESTATION_KIND = 30410;

function decodeSigningKey() {
  const nsec =
    (config.dataExportSigning && config.dataExportSigning.nsec) || '';

  if (!nsec) {
    return null;
  }

  try {
    const decoded = nip19.decode(nsec);

    if (decoded.type !== 'nsec') {
      throw new Error(`Expected an nsec, got a ${decoded.type}`);
    }

    // Decoding only proves the bech32 is well formed; getPublicKey rejects
    // scalars outside 0 < d < curve order, which would otherwise surface from
    // finalizeEvent on every download.
    getPublicKey(decoded.data);

    return decoded.data;
  } catch (error) {
    log('error', 'Could not decode the data export signing key #dg4hd2', {
      error: error.message,
    });
    return null;
  }
}

/**
 * @returns {object|null} a detached signature, or `null` when no usable
 *   signing key is configured. An unsigned export is a degraded export, not a
 *   failed one.
 */
function signPayload(payload, { username, now } = {}) {
  const secretKey = decodeSigningKey();

  if (!secretKey) {
    return null;
  }

  const { sections, root } = canonical.digestPayload(payload);
  const createdAt = Math.floor((now ? now.getTime() : Date.now()) / 1000);

  const event = finalizeEvent(
    {
      kind: ATTESTATION_KIND,
      created_at: createdAt,
      tags: [
        ['x', root],
        ['m', 'application/json'],
        ['d', username || ''],
        ['alt', 'Trustroots member data export attestation'],
      ],
      content: '',
    },
    secretKey,
  );

  return {
    alg: canonical.SIGNATURE_ALGORITHM,
    signed: ['format', 'version', ...canonical.SECTION_NAMES],
    sections,
    root,
    event,
  };
}

export { ATTESTATION_KIND, signPayload };
