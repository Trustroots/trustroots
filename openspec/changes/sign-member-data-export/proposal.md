## Why

The member data export exists so that a fork of Trustroots can receive a member's data, but a fork has no way to tell `trustroots-data.json` from a file the member typed by hand. The exported social graph therefore carries no weight, and "forkable" stops at "you can copy your own text out". Issue #2669 asks for a Nostr signature over the file.

Signing is only worth something if the signed bytes are a pure function of the member's data. Today they are not: `exportedAt` is stamped at request time, object key order is decided by Mongo and Express, and the contacts and hosting-offer aggregations return documents in no guaranteed order. Determinism is the substance of this change; the signature is the easy part.

## What Changes

- Bump the export to version `2` and add a detached `signature` object carrying per-section SHA-256 digests, a root digest, and a NIP-01 attestation event.
- Define the signed bytes as RFC 8785 canonical JSON over `format`, `version`, `profile`, `contacts`, and `hostingOffers`, with list sections sorted deterministically before they are digested and sent.
- Keep `exportedAt` in the file but outside the signature, since it varies per request.
- Serve an unsigned export with a logged warning when no signing key is configured, never an error.
- Add a standalone verifier that checks a downloaded file without a server, a database, or a network, and reports which section failed and what the signing key's status is.
- Add a pinned public-key history and a documented rotation and revocation procedure.

## Capabilities

### Modified Capabilities

- `account-access`: the member data export is signed and deterministic, and can be verified independently of Trustroots.

## Impact

- Changes the export format from version `1` to version `2`. Nothing consumes it yet, so this is the cheapest moment to change it.
- Adds no production dependency: `nostr-tools` is already one.
- Requires a dedicated signing key to be provisioned and its nsec injected at runtime. The key is hot by construction, because the export is generated per request.
- Does not add timestamping. A NIP-01 `created_at` is chosen by the signer, so this change proves authorship but not time; anchoring is scoped as a follow-up.
- Does not widen what the export contains. It does change the character of the third-party data already in `contacts`, from deniable to attested; the open decisions are recorded in `docs/data-export-signing.md`.
