# nostr-profile-signers Specification

## Purpose

Let members use remote and Android Nostr signers to link their public key to their Trustroots profile.

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

### Requirement: Sign the profile key ownership challenge

Members SHALL be able to sign the profile key ownership challenge through NIP-07, NIP-46 or NIP-55. Adding or replacing a key SHALL use the same ownership proof and profile save for every signer.

#### Scenario: Save a key using a signer

- **WHEN** the member saves a new key and approves the request to sign its fresh ownership challenge
- **THEN** the editor submits the signed event with the profile update
- **AND** the server consumes the valid challenge and saves the public key

#### Scenario: Reject invalid or reused proof

- **WHEN** proof is expired, reused, malformed, altered or signed by a different key
- **THEN** the server rejects the update and retains the existing profile

#### Scenario: Save an unchanged key or remove the linked key

- **WHEN** a member saves an unchanged key or removes it
- **THEN** the server permits the update without requesting a signature
