# Signing the member data export

`GET /api/users/export` serves a member their own profile, contacts, and hosting offers as `trustroots-data.json`. From version 2 of that format the file also carries a `signature`: a Nostr attestation from Trustroots that the data in it is what Trustroots holds. The point is [issue #2669](https://github.com/Trustroots/trustroots/issues/2669) — a fork that receives the file needs some way to tell it from a file the member typed by hand, otherwise the exported social graph carries no weight and "forkable" stops at "you can copy your own text out".

## Determinism comes first

A signature over bytes that change on every download attests nothing useful: two downloads a minute apart would produce two unrelated digests, and nobody could tell a changed digest from an unchanged one. So before anything is signed, three sources of variation are removed.

**Request-time metadata is excluded from the signed payload.** `exportedAt` is stamped when the request arrives, so it stays in the file — it is genuinely useful to the member — but sits outside what the signature covers. The signature's `signed` array names exactly what is covered: `format`, `version`, `profile`, `contacts`, `hostingOffers`. Nothing else.

**Key order is fixed by canonicalisation.** Mongo, Mongoose, and Express between them make no promise about the order of object keys. The signed bytes are [RFC 8785 JCS](https://www.rfc-editor.org/rfc/rfc8785) canonical JSON: keys sorted by UTF-16 code unit, no insignificant whitespace, ECMAScript number formatting. That also means a file that has been through a text editor or a re-save still verifies, because the verifier re-canonicalises rather than comparing raw bytes.

**List order is fixed by sorting.** JCS does not reorder arrays, and the contacts and hosting-offer aggregations return documents in no guaranteed order — this is the part that canonicalisation alone would have missed. `contacts` and `hostingOffers` are sorted by `_id`, with the item's own canonical form as a tiebreak, before they are digested *and* before they are sent, so the delivered file canonicalises to exactly what was signed.

The result is that the *attested content* is a pure function of the member's data: two downloads of unchanged data yield the same section digests and the same root digest. The attestation itself is not byte-identical between downloads — `created_at` moves and Schnorr signing uses fresh randomness — and it does not need to be. The root digest is the stable identifier of a member's exported state.

## What is signed, and how

The signature is detached: it sits alongside the payload rather than inside it, so nothing has to be punched out of the document before verification.

```json
"signature": {
  "alg": "nostr-schnorr-secp256k1/jcs-sha256",
  "signed": ["format", "version", "profile", "contacts", "hostingOffers"],
  "sections": { "profile": "<sha256>", "contacts": "<sha256>", "hostingOffers": "<sha256>" },
  "root": "<sha256>",
  "event": { "kind": 30410, "pubkey": "…", "created_at": 1788609600, "tags": [["x", "<root>"], ["m", "application/json"], ["d", "<username>"], ["alt", "Trustroots member data export attestation"]], "content": "", "id": "…", "sig": "…" }
}
```

Each section is digested separately, and the root digest covers the section digests together with `format` and `version`. Sectioning costs almost nothing and buys three things: a member can hand a fork the profile section alone and have it still verify; adding a section later does not invalidate existing verifiers; and the Merkle-shaped structure is what a future transparency log would hang from.

The envelope is a plain NIP-01 event — BIP-340 Schnorr over secp256k1, `id` the SHA-256 of the serialised event array — so any Nostr library verifies it without knowing anything about Trustroots. The tag vocabulary is borrowed from [NIP-94](https://github.com/nostr-protocol/nips/blob/master/94.md) (`x`, `m`, `alt`), but not its kind 1063: 1063 means "a file is downloadable at this URL", and this file is generated on demand behind authentication and never lives at an address. Kind **30410 is a placeholder** pending an assignment in the nostroots `nr-common` kind registry. The attestation travels inside the exported file rather than to a relay, so replaceable-kind semantics never come into play.

The member's data is deliberately *not* restructured into Nostr events. Designing kinds for hosting offers and contact edges — and deciding whose key signs a contact edge — is a protocol design project. Nostroots is where Trustroots data becomes Nostr-native; this export attests what Trustroots holds.

## Verifying

```
node bin/verify-data-export.js trustroots-data.json
```

Exit 0 when every check passes, 1 otherwise. It needs no server, no database, and no network. It checks, in order: the format and version; each section's digest; the root against the section digests and against the event's `x` tag; the event id and Schnorr signature; and the signing key against the pinned key history in `config/data-export-signing-keys.json`.

It reports rather than merely passing or failing, because a fork operator deciding whether to trust an imported social graph needs to know *which* section failed and what the signing key's status is. It also distinguishes an absent section from an empty one, so a partial file cannot be mistaken for a member with no contacts.

## What a signature does not prove

**It does not prove when the file was signed.** NIP-01 `created_at` is chosen by whoever holds the key, so a thief with the key can mint a signature dated last year. A signature proves authorship, not time. This matters directly for the property asked for in #2669 — that signatures made before a compromise stay good — which a signature alone cannot deliver.

What this design does deliver today is the weaker, honest version: once a key is declared compromised, a verifier can reject signatures whose claimed date falls after the compromise, and can report that an earlier claimed date is *unproven*. The verifier says so in those words rather than returning a bare "valid".

Making the strong version true needs an independent time anchor. The intended follow-up is OpenTimestamps: accumulate the day's root digests, publish the Merkle root, and stamp it so that Bitcoin attests the root existed no later than a given block. That gives a genuine upper bound on the signing time from a source Trustroots cannot forge. The sectioned root digest exists so that this is an addition rather than a format break. It is deliberately not part of this change.

**The key is hot by construction.** The export is generated per request, so the signing key must be reachable from the web app's request path. Compromise of the app server is compromise of the key. The mitigation is not secrecy but a bounded blast radius: rotation, a published key history, and eventually the time anchor above.

## Key custody

The signing key is a dedicated secp256k1 keypair used for nothing else — not the nostroots server key, not any member key, not a key that also posts. It is generated offline and injected at runtime as an nsec:

```
TRUSTROOTS_EXPORT_SIGNING_NSEC=nsec1…
```

or as `dataExportSigning.nsec` in `config/env/local.js`. **An nsec must never be committed** — not to this repository, not to a compose file, not to an ansible inventory in the clear. With no key configured the export is served unsigned and the server logs a warning; that is a degraded export, never a failed request.

## Key distribution

A key published on trustroots.org is exactly as trustworthy as trustroots.org, which is the thing a fork exists to stop depending on. No single channel fixes that. Together, these make a *silent* key substitution require compromising several independent parties, and a *loud* one visible. That is the achievable property; claiming more would be false.

1. `config/data-export-signing-keys.json` in this repository — the pinned history the verifier reads. A fork operator who audits it once inherits the trust anchor. This is the strongest link, and it is the Debian `debian-archive-keyring` model: distribute the key with the client, not from the server being verified.
2. A signed git tag in `Trustroots/trustroots`, so the introduction is timestamped and third-party-mirrored.
3. `https://www.trustroots.org/.well-known/nostr.json?name=_` — convenient, and the weakest link, because it is served by the party being verified.
4. A Nostr event published to `relay.trustroots.org` and to public relays, so third-party relay operators hold copies Trustroots cannot silently retract.
5. An announcement on the issue and the blog, so the introduction is publicly witnessed.

## Rotation and revocation

Rotate annually as well as on suspicion, so the mechanism is exercised rather than theoretical.

*Retirement* and *revocation* are different, and the key history records both. A retired key's old signatures stay good — set `status: "retired"` and `validUntil`. A compromised key's signatures are good only up to the compromise boundary — set `status: "compromised"` and `revokedAt`, and expect the verifier to say that any earlier claimed date is unproven until the time anchor exists.

Each history entry should be signed by the *next* key and, ideally, counter-signed by a long-lived offline root key held by more than one volunteer. Otherwise whoever steals the signing key can also rewrite its own obituary.

To rotate:

1. Generate the new keypair offline. Keep the nsec out of every repository.
2. Add the new public key to `config/data-export-signing-keys.json` as `active`, with `validFrom`, and mark the outgoing key `retired` with a `validUntil`. Open a pull request; that is the public record.
3. Deploy the new nsec through the runtime secret mechanism, then restart.
4. Verify a fresh export end to end with `bin/verify-data-export.js`.
5. Announce through the distribution channels above.

To revoke a compromised key, do the same but set `status: "compromised"` and `revokedAt` to the earliest time the compromise might have begun — the earliest, not the latest, because the boundary cannot be proven.

## Privacy

The `contacts` section carries **other members'** usernames, display names, home and current locations, Facebook IDs, and `emailHash` — an MD5 of a lowercased email address, which is reversible in practice for any address on a wordlist.

Signing changes what that is. Unsigned, the file is deniable: a third party who obtains it cannot tell it from a fabrication, so it is worth little to a data broker or a harasser. Signed, it becomes an artifact Trustroots vouches for about people who never consented to it, transferable to anyone. That harm does not exist today; attestation creates it.

This change does not widen what the export contains — the field set is untouched. Sectioning is the first mitigation: the `contacts` attestation can be presented separately or withheld, and the verifier reports a withheld section rather than treating it as empty. Three further decisions are open, and they belong to the maintainers rather than to this change, because they are a values call about a community's data:

- reduce the signed contact records to edges and identifiers, dropping the other party's location;
- replace `emailHash` with something not reversible, or drop it, since a fork can obtain a Gravatar hash itself once the member is present;
- or accept the disclosure as it stands.
