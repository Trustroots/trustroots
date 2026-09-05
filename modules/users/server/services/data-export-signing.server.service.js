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

const { finalizeEvent } = require('nostr-tools/pure');
const nip19 = require('nostr-tools/nip19');

const config = require('../../../../config/config');
const log = require('../../../../config/lib/logger');
const canonical = require('./data-export-canonical.server.service');

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

module.exports = {
  ATTESTATION_KIND,
  signPayload,
};
