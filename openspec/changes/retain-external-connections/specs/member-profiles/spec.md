## ADDED Requirements

### Requirement: Private external connection history

The system SHALL retain public profile identifiers for BeWelcome, Couchers, Couchsurfing, Warmshowers, Servas, Nostr, Facebook, Twitter and GitHub when added, replaced or removed. History SHALL be private, atomic with successful changes, and deleted with the account. Failed or normalised unchanged saves SHALL NOT add changes. Legacy provider credentials SHALL NOT be retained.

#### Scenario: A member replaces or removes a connection

- **WHEN** a member successfully replaces or removes an external identifier
- **THEN** its previous and new values and change timestamp are retained privately
- **AND** concurrent changes cannot overwrite intervening history

#### Scenario: Existing connections are initialised

- **WHEN** the backfill or first subsequent edit initialises an existing member
- **THEN** existing connections are recorded with unknown original dates
- **AND** reruns and concurrent edits do not duplicate or overwrite history

#### Scenario: Ordinary profile access and deletion

- **WHEN** a member or visitor reads a profile
- **THEN** history and search keys are omitted
- **AND** deleting the account deletes its embedded history
