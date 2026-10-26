# radio-circle Specification

## Purpose

TBD - created by archiving change add-radio-circle. Update Purpose after archive.

## Requirements

### Requirement: Public radio playback

The Radio circle SHALL provide the existing Radiostr station catalogue, grouped
stations, local favourites, station hash links and user-initiated audio playback.
Playback SHALL stop when leaving the circle. Playback failures SHALL be visible
and SHALL NOT prevent choosing another station.

#### Scenario: A visitor listens

- **WHEN** a logged-out visitor opens the Radio circle and selects a station
- **THEN** they can play, pause and favourite it, and see the shared listener count
- **AND** chat and listener identities are hidden

### Requirement: Authenticated social interface

Chat and listener identities SHALL be shown only to logged-in Trustroots members.
The interface SHALL NOT subscribe to chat or fetch listener profiles for visitors.
These restrictions SHALL NOT claim that public Nostr events are private.

#### Scenario: A member reads the room

- **WHEN** a logged-in member opens the circle without a signer
- **THEN** they can read chat and see listeners but cannot publish

### Requirement: Matching verified signing identity

Publication SHALL require an explicitly connected Nostr signer matching both the
logged-in member's linked npub and the member's Trustroots NIP-05 lookup. The
application SHALL store no secret keys and SHALL verify signed event contents.

#### Scenario: A mismatched signer connects

- **WHEN** the extension key differs from the member's linked key or NIP-05 lookup
- **THEN** publishing is disabled and the mismatch is explained

### Requirement: Radiostr compatibility

Chat, favourites and listening events SHALL use the existing kind-1 Radiostr tags,
station IDs, thirty-day expiration, and Trustroots/Nomadwiki relays. Listener
counts SHALL deduplicate public keys and expire activity after twelve minutes.
Verified connected members SHALL share activity after ten seconds of playback,
then every five minutes while playing. Favourites SHALL reconcile local state
with that signer's relay events, preserving remote unstar actions.

#### Scenario: Both interfaces are in use

- **WHEN** Radiostr publishes a supported room event
- **THEN** the circle processes it using the same station and room identities
- **AND** duplicate relay deliveries do not duplicate messages or listeners
