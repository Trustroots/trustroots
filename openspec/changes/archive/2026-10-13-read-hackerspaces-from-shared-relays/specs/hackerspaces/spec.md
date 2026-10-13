## ADDED Requirements

### Requirement: Multi-relay place discovery

The public Hackers circle map and administrator import preview SHALL read place
events from both `wss://relay.trustroots.org` and `wss://relay.nomadwiki.org`.
The system SHALL merge duplicate events, preserve the newest addressable version
per author, and continue discovery when one relay is unavailable. Discovery
connections SHALL be closed when their subscriptions are no longer needed.
Publication failures SHALL include the relay's rejection reason when available.

#### Scenario: A place exists only on Nomadwiki

- **WHEN** an imported place is available on Nomadwiki but absent from Trustroots
- **THEN** the public map displays it
- **AND** an import preview recognises it as an existing listing

#### Scenario: Duplicate and updated places span both relays

- **WHEN** both relays return the same event or different versions of one addressable place
- **THEN** the map displays only its newest version for that author
- **AND** the import preview compares against that newest version

#### Scenario: One discovery relay is unavailable

- **WHEN** one relay cannot connect or closes its subscription
- **THEN** discovery continues using the remaining relay
- **AND** the map does not report complete unavailability while that relay remains usable

#### Scenario: Publication is rejected

- **WHEN** a relay rejects a signed place event
- **THEN** the import UI shows that relay's rejection reason
- **AND** publication continues to the other relay
