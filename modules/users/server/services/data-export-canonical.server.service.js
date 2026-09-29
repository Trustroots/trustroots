/**
 * Deterministic serialisation for the member data export.
 *
 * A signature is only worth something if the bytes it covers are a pure
 * function of the member's data. The export is generated on demand, so three
 * separate sources of variation have to be removed before anything is signed:
 *
 * 1. `exportedAt` is stamped at request time. It is therefore kept out of the
 *    signed payload entirely (see `buildSignedPayload`).
 * 2. Object key order is decided by Mongo, Mongoose, and Express. RFC 8785
 *    (JSON Canonicalization Scheme) fixes it: keys sorted by UTF-16 code unit,
 *    no insignificant whitespace, ECMAScript number formatting.
 * 3. The contacts and hosting-offer aggregations return documents in no
 *    guaranteed order. JCS does not reorder arrays, so the sections are sorted
 *    here before they are canonicalised *and* before they are sent, so that the
 *    delivered file matches what was signed.
 */

const crypto = require('crypto');

const EXPORT_FORMAT = 'trustroots-data-export';
const EXPORT_VERSION = 2;
const SECTION_NAMES = ['profile', 'contacts', 'hostingOffers'];
const SIGNATURE_ALGORITHM = 'nostr-schnorr-secp256k1/jcs-sha256';

function serialise(value) {
  if (value === null) {
    return 'null';
  }

  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) {
        throw new TypeError('Cannot canonicalise a non-finite number');
      }
      // `JSON.stringify` uses ECMAScript Number::toString, which is what
      // RFC 8785 prescribes. `-0` serialises as `0`, also per the RFC.
      return JSON.stringify(value === 0 ? 0 : value);
    case 'string':
      return JSON.stringify(value);
    case 'object':
      break;
    default:
      return undefined;
  }

  if (Array.isArray(value)) {
    const items = value.map(item => {
      const serialised = serialise(item);
      return serialised === undefined ? 'null' : serialised;
    });
    return `[${items.join(',')}]`;
  }

  const members = [];
  // Default string sort compares UTF-16 code units, as RFC 8785 requires.
  Object.keys(value)
    .sort()
    .forEach(key => {
      const serialised = serialise(value[key]);
      if (serialised !== undefined) {
        members.push(`${JSON.stringify(key)}:${serialised}`);
      }
    });

  return `{${members.join(',')}}`;
}

/**
 * RFC 8785 canonical JSON for an already-plain JSON value.
 */
function canonicalise(value) {
  const serialised = serialise(value);

  if (serialised === undefined) {
    throw new TypeError('Value is not representable as canonical JSON');
  }

  return serialised;
}

/**
 * Turn Mongoose documents, ObjectIds, and Dates into plain JSON values, so
 * that canonicalisation only ever sees objects, arrays, strings, numbers,
 * booleans, and null.
 */
function toPlainJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

function sortSection(items) {
  return items
    .map(item => ({ item, canonical: canonicalise(item) }))
    .sort((a, b) => {
      const left = String((a.item && a.item._id) || '');
      const right = String((b.item && b.item._id) || '');

      if (left !== right) {
        return left < right ? -1 : 1;
      }

      if (a.canonical === b.canonical) {
        return 0;
      }

      return a.canonical < b.canonical ? -1 : 1;
    })
    .map(entry => entry.item);
}

/**
 * The exact object the signature covers: the member's data and the format
 * identifiers, and nothing that varies between two downloads of unchanged
 * data.
 */
function buildSignedPayload({ profile, contacts, hostingOffers } = {}) {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    profile: toPlainJson(profile || {}),
    contacts: sortSection(toPlainJson(contacts || [])),
    hostingOffers: sortSection(toPlainJson(hostingOffers || [])),
  };
}

/**
 * One digest per section, plus a root digest that also binds the format and
 * version. Sections are digested separately so that a member can hand on a
 * single section — the profile without the contacts, say — and have it still
 * verify.
 */
function digestPayload(payload) {
  const sections = {};

  SECTION_NAMES.forEach(name => {
    sections[name] = sha256Hex(canonicalise(payload[name]));
  });

  const root = sha256Hex(
    canonicalise({
      format: payload.format,
      version: payload.version,
      sections,
    }),
  );

  return { sections, root };
}

module.exports = {
  EXPORT_FORMAT,
  EXPORT_VERSION,
  SECTION_NAMES,
  SIGNATURE_ALGORITHM,
  buildSignedPayload,
  canonicalise,
  digestPayload,
  sha256Hex,
  toPlainJson,
};
