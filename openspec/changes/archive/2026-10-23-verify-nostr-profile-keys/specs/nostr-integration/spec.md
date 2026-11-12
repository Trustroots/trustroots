## MODIFIED Requirements

### Requirement: Nostr public-key association

The system SHALL let a member associate one valid Nostr public key (`npub`) with their profile, canonicalise the stored public-key value, and prevent the same public key from being associated with more than one member. Adding or replacing a non-empty key SHALL require a valid signed, fresh, single-use server challenge bound to the authenticated member and requested key. The editor SHALL support NIP-07, NIP-46 bunker signing and externally signed events without requesting private keys or publishing proofs. Existing unchanged keys and removal SHALL NOT require proof.

#### Scenario: Member saves a valid public key

- **WHEN** a signed-in member supplies a valid signature over their fresh challenge using the requested key
- **THEN** the system consumes the challenge and saves the canonical npub
- **AND** the saved value remains available when the member revisits network settings

#### Scenario: Member submits an invalid or secret key

- **WHEN** a member submits an invalid Nostr key or a Nostr secret key
- **THEN** the system rejects the value and explains that it is invalid

#### Scenario: Member submits another member's public key

- **WHEN** a member submits a public key already associated with another member
- **THEN** the system rejects the update and explains that the key is already in use

#### Scenario: Missing or invalid ownership proof

- **WHEN** a member changes a non-empty key without proof, or supplies expired, reused, altered, wrong-member or wrong-key proof
- **THEN** the system rejects the update and retains the existing profile

#### Scenario: Signer rejects a request

- **WHEN** signing fails, is rejected or times out
- **THEN** the editor preserves draft values and permits retry
- **AND** temporary remote signer resources are closed

#### Scenario: Existing association or removal

- **WHEN** a member saves an unchanged key or removes it
- **THEN** the system permits the update without requesting a signature

#### Scenario: Nostroots bridge associates a key

- **WHEN** nr-bridge writes an npub through its existing email verification flow
- **THEN** the shared user document remains compatible with that write
- **AND** NIP-05 lookup and unchanged-key profile saves continue to work
