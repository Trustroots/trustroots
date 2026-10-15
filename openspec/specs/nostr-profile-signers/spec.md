# nostr-profile-signers Specification

## Purpose

TBD - created by archiving change add-nostr-signers. Update Purpose after archive.

## Requirements

### Requirement: Import public keys through signers

The profile networks editor SHALL support NIP-07, NIP-46 bunker and generated Nostr Connect pairing, and NIP-55 Android signer public-key import. Members SHALL explicitly accept suggested keys and save them through the existing form.

#### Scenario: Import without changing other profile fields

- **WHEN** a member accepts a signer public key
- **THEN** its npub becomes a draft value without automatically saving or changing unrelated fields

#### Scenario: Cancel or fail a connection

- **WHEN** pairing is cancelled, rejected, expires or fails
- **THEN** the editor preserves draft values, offers retry and releases temporary signer resources

#### Scenario: Return from an Android signer

- **WHEN** a correlated unexpired NIP-55 callback returns
- **THEN** the editor restores drafts and processes the result, removes callback data from the URL and clears pending state

### Requirement: Optional proof of saved-key ownership

Members SHALL be able to verify a saved key using a signed fresh server challenge through NIP-07, NIP-46 or NIP-55. Verification SHALL remain optional and visible only to the owning member.

#### Scenario: Verify a saved key

- **WHEN** a valid signed challenge matches the member, saved key, endpoint and method
- **THEN** the server atomically consumes the challenge and records ownership verification

#### Scenario: Reject invalid or reused proof

- **WHEN** proof is expired, reused, malformed, altered or signed by a different key
- **THEN** the server rejects it without recording verification

#### Scenario: Change the linked key

- **WHEN** a member changes or removes the canonical saved npub
- **THEN** previous verification and pending challenges are invalidated

#### Scenario: Retain compatibility

- **WHEN** a member manually links a key or views an existing link
- **THEN** manual linking, uniqueness checks and public NIP-05/profile behaviour continue without requiring verification
