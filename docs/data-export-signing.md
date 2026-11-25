# Signing the member data export

`GET /api/users/export` serves a member their own profile, circles, contacts, hosting offers, written messages, and written experiences as `trustroots-data-<username>-<UTC timestamp>.json`. From version 2 of that format the file also carries a `signature`: a Nostr attestation from Trustroots that the data in it is what Trustroots holds. The point is [issue #2669](https://github.com/Trustroots/trustroots/issues/2669) — a fork that receives the file needs some way to tell it from a file the member typed by hand, otherwise the exported social graph carries no weight and "forkable" stops at "you can copy your own text out".

## Determinism comes first

A signature over bytes that change on every download attests nothing useful: two downloads a minute apart would produce two unrelated digests, and nobody could tell a changed digest from an unchanged one. So before anything is signed, three sources of variation are removed.

**Request-time metadata is excluded from the signed payload.** `exportedAt` is stamped when the request arrives, so it stays in the file — it is genuinely useful to the member — but sits outside what the signature covers. The signature's `signed` array names exactly what is covered: `format`, `version`, `profile`, `contacts`, `hostingOffers`, `circles`, `messages`, and `experiences`.

**Key order is fixed by canonicalisation.** Mongo, Mongoose, and Express between them make no promise about the order of object keys. The signed bytes are [RFC 8785 JCS](https://www.rfc-editor.org/rfc/rfc8785) canonical JSON: keys sorted by UTF-16 code unit, no insignificant whitespace, ECMAScript number formatting. That also means a file that has been through a text editor or a re-save still verifies, because the verifier re-canonicalises rather than comparing raw bytes.

**List order is fixed by sorting.** JCS does not reorder arrays, and the contacts and hosting-offer aggregations return documents in no guaranteed order — this is the part that canonicalisation alone would have missed. `contacts`, `hostingOffers`, `circles`, `messages`, and `experiences` are sorted by `_id`, with the item's own canonical form as a tiebreak, before they are digested _and_ before they are sent, so the delivered file canonicalises to exactly what was signed.

The result is that the _attested content_ is a pure function of the member's data: two downloads of unchanged data yield the same section digests and the same root digest. The attestation itself is not byte-identical between downloads — `created_at` moves and Schnorr signing uses fresh randomness — and it does not need to be. The root digest is the stable identifier of a member's exported state.

## What is signed, and how

The signature is detached: it sits alongside the payload rather than inside it, so nothing has to be punched out of the document before verification.

```json
"signature": {
  "alg": "nostr-schnorr-secp256k1/jcs-sha256",
  "signed": ["format", "version", "profile", "contacts", "hostingOffers", "circles", "messages", "experiences"],
  "sections": { "profile": "<sha256>", "contacts": "<sha256>", "hostingOffers": "<sha256>", "circles": "<sha256>", "messages": "<sha256>", "experiences": "<sha256>" },
  "root": "<sha256>",
  "event": { "kind": 30410, "pubkey": "…", "created_at": 1788609600, "tags": [["x", "<root>"], ["m", "application/json"], ["d", "<username>"], ["alt", "Trustroots member data export attestation"]], "content": "", "id": "…", "sig": "…" }
}
```

Each section is digested separately, and the root digest covers the section digests together with `format` and `version`. Sectioning costs almost nothing and buys three things: a member can hand a fork the profile section alone and have it still verify; adding a section later does not invalidate existing verifiers; and the Merkle-shaped structure is what a future transparency log would hang from.

The envelope is a plain NIP-01 event — BIP-340 Schnorr over secp256k1, `id` the SHA-256 of the serialised event array — so any Nostr library verifies it without knowing anything about Trustroots. The tag vocabulary is borrowed from [NIP-94](https://github.com/nostr-protocol/nips/blob/master/94.md) (`x`, `m`, `alt`), but not its kind 1063: 1063 means "a file is downloadable at this URL", and this file is generated on demand behind authentication and never lives at an address. Kind **30410 is a placeholder** pending an assignment in the nostroots `nr-common` kind registry. The attestation travels inside the exported file rather than to a relay, so replaceable-kind semantics never come into play.

The member's data is deliberately _not_ restructured into Nostr events. Designing kinds for hosting offers and contact edges — and deciding whose key signs a contact edge — is a protocol design project. Nostroots is where Trustroots data becomes Nostr-native; this export attests what Trustroots holds.

## Verifying

```
node bin/verify-data-export.mts trustroots-data.json
```

The verifier runs offline. It checks the format and version, every supplied section against its digest, the root against the digest manifest, the event kind and its `x` tag, the event signature, and the signing key against `config/data-export-signing-keys.json`.

The CLI exits 0 for a verified full or partial export and exits 1 if a check fails. To share a partial export, keep `format`, `version`, the entire `signature` object and at least one data section. The report marks omitted sections as absent and identifies a successful partial verification as `OK (partial export)`.

## What a signature does not prove

**It does not prove when the file was signed.** NIP-01 `created_at` is chosen by whoever holds the key, so a thief with the key can mint a signature dated last year. A signature proves authorship, not time. This matters directly for the property asked for in #2669 — that signatures made before a compromise stay good — which a signature alone cannot deliver.

What this design does deliver today is the weaker, honest version: once a key is declared compromised, a verifier can reject signatures whose claimed date falls after the compromise, and can report that an earlier claimed date is _unproven_. The verifier says so in those words rather than returning a bare "valid".

Independent timestamping is a follow-up. A proof should cover the signed attestation, including its signature. For example, Trustroots could batch hashes of signed attestations into a Merkle tree and stamp its root with OpenTimestamps. An importer with an inclusion proof could then verify that the signature existed by the time of the anchoring block.

**The key is hot by construction.** The export is generated per request, so the signing key must be reachable from the web app's request path. Compromise of the app server is compromise of the key. The mitigation is not secrecy but a bounded blast radius: rotation, a published key history, and eventually the time anchor above.

## Key custody

The export uses `_@trustroots.org`, the same service signer as circle chat. The webapp reads the existing nsec from its runtime environment.

```
TRUSTROOTS_NOSTR_SERVICE_NSEC=nsec1…
```

Keep the nsec in the deployment environment. With no usable key configured, the export is served unsigned and the server logs a warning.

## Key distribution

The offline verifier uses the public keys pinned in `config/data-export-signing-keys.json`. The active service key is also published through the [NIP-05 lookup for `_@trustroots.org`](https://trustroots.org/.well-known/nostr.json?name=_). The initial key is pinned as active from 24 November 2026.

## Rotation and revocation

Rotate annually as well as on suspicion, so the mechanism is exercised rather than theoretical.

_Retirement_ and _revocation_ are different, and the key history records both. A retired key's old signatures stay good — set `status: "retired"` and `validUntil`. A compromised key's signatures are good only up to the compromise boundary — set `status: "compromised"` and `revokedAt`, and expect the verifier to say that any earlier claimed date is unproven until the time anchor exists.

Each history entry should be signed by the _next_ key and, ideally, counter-signed by a long-lived offline root key held by more than one volunteer. Otherwise whoever steals the signing key can also rewrite its own obituary.

To rotate:

1. Generate the new keypair offline. Keep the nsec out of every repository.
2. Add the new public key to `config/data-export-signing-keys.json` as `active`, with `validFrom`, and mark the outgoing key `retired` with a `validUntil`. Open a pull request; that is the public record.
3. Deploy the new nsec through the runtime secret mechanism, then restart.
4. Verify a fresh export end to end with `bin/verify-data-export.mts`.
5. Check that the NIP-05 lookup returns the new active public key.

To revoke a compromised key, do the same but set `status: "compromised"` and `revokedAt` to the earliest time the compromise might have begun — the earliest, not the latest, because the boundary cannot be proven.

## Privacy

Signed and unsigned exports include each contact relationship's ID, parties, confirmation status and creation date, plus the other member's ID, username and display name. The download excludes other members' location fields, email hashes, Facebook identifiers and other mini-profile metadata. Members can also omit the entire contact section when sharing a partial export.
