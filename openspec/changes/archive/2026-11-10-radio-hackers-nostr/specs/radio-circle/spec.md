## MODIFIED Requirements

### Requirement: Matching verified signing identity

Publication SHALL require a Nostr signer matching both the logged-in member's linked npub and the member's Trustroots NIP-05 lookup. The Radio circle SHALL detect a complete NIP-07 provider on entry and for up to five seconds and attempt connection once for a member with a linked npub. Manual retry SHALL remain available. The application SHALL store no secret keys and SHALL verify signed event contents.

#### Scenario: A mismatched signer connects

- **WHEN** the extension key differs from the member's linked key or NIP-05 lookup
- **THEN** publishing is disabled and the mismatch is explained

#### Scenario: A matching extension is available

- **WHEN** a logged-in member with a linked npub opens Radio with a matching NIP-07 extension
- **THEN** Radio connects the signer automatically
- **AND** uses the signer for chat, favourites and listening activity

## ADDED Requirements

### Requirement: Immediate local listening contribution

Radio SHALL count local playback immediately for signed-in and anonymous listeners, label the local contribution, and deduplicate it against shared activity when the linked public key is known. The local contribution SHALL end when playback stops or fails. The shared listener list SHALL continue to reflect relay activity.

#### Scenario: Playback starts before a shared announcement

- **WHEN** a listener starts playback without an active shared event for their key
- **THEN** their browser counts them immediately and labels the local contribution
- **AND** a subsequent shared event for the linked key is counted once
