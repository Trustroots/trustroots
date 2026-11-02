## 1. Deterministic serialisation

- [x] 1.1 Add RFC 8785 canonical JSON and SHA-256 digesting for the export
- [x] 1.2 Exclude request-time metadata from the signed payload
- [x] 1.3 Sort list sections deterministically before digesting and sending

## 2. Signing

- [x] 2.1 Sign the root digest with a dedicated Nostr key as a NIP-01 event
- [x] 2.2 Serve an unsigned export with a warning when no key is configured
- [x] 2.3 Bump the export format to version 2

## 3. Verification

- [x] 3.1 Add a standalone verifier that reports per-section results
- [x] 3.2 Report the signing key's status against a pinned key history
- [x] 3.3 Distinguish a withheld section from an empty one

## 4. Operations and documentation

- [x] 4.1 Document determinism, key custody, distribution, and rotation
- [x] 4.2 Record the timestamping limitation and the privacy consequence
- [ ] 4.3 Generate the signing key and publish its public key
- [ ] 4.4 Exercise rotation once in staging end to end
