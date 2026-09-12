# Nostr Integration Specification

## Purpose

Let Trustroots members connect their Nostr identity and discover community
notes through Nostroots while preserving the privacy of non-public profiles.

## Requirements

### Requirement: Nostr public-key association

The system SHALL let a member associate one valid Nostr public key (`npub`)
with their profile, canonicalise the stored public-key value, and prevent the
same public key from being associated with more than one member.

#### Scenario: Member saves a valid public key

- **WHEN** a signed-in member saves a valid Nostr public key in their network settings
- **THEN** the system saves its canonical public-key representation
- **AND** the saved value remains available when the member revisits network settings

#### Scenario: Member submits an invalid or secret key

- **WHEN** a member submits an invalid Nostr key or a Nostr secret key
- **THEN** the system rejects the value and explains that it is invalid

#### Scenario: Member submits another member's public key

- **WHEN** a member submits a public key already associated with another member
- **THEN** the system rejects the update and explains that the key is already in use

### Requirement: Public NIP-05 identity lookup

The system SHALL expose the Nostr public key of a confirmed public member
through the NIP-05 well-known endpoint and SHALL not expose keys for
non-public or unknown members.

#### Scenario: NIP-05 lookup finds a public member

- **WHEN** a client requests the well-known Nostr record for a confirmed public member with a saved public key
- **THEN** the response maps the member's username to their Nostr public key
- **AND** permits cross-origin lookup

#### Scenario: NIP-05 lookup cannot find an eligible member

- **WHEN** a client requests the well-known Nostr record for an unknown, unconfirmed, or hidden member
- **THEN** the response contains no public-key mapping for that member

### Requirement: Nostr profile presentation and statistics

The system SHALL show a member's Nostr identity on their profile and include
Nostr connections in public connection statistics.

#### Scenario: Visitor views a profile with a saved public key

- **WHEN** a visitor views a member profile with a saved Nostr public key
- **THEN** the profile links the Nostr address to the member's Nostroots profile

#### Scenario: Visitor views connection statistics

- **WHEN** a visitor views public connection statistics
- **THEN** the statistics include the count of members connected to Nostr

### Requirement: Community-note discovery

The system SHALL let signed-in members enable a persistent Community Notes
filter on the search map and read the associated Nostroots thread for a
selected location. The map SHALL fetch only original kind `30397` events and
SHALL NOT fetch kind `30398` validation-server events, so that current
Trustroots account visibility can be applied without depending on a stale
validation decision. It SHALL exclude notes authored by known Trustroots
members who are not eligible for public display while preserving notes from
valid Nostr authors who are not linked to a Trustroots account.

#### Scenario: Member enables Community Notes

- **WHEN** a signed-in member enables the Community Notes search filter
- **THEN** the map displays available original community-note locations from eligible and unlinked authors
- **AND** excludes notes from known shadowbanned, suspended, or private authors
- **AND** excludes notes with malformed author keys
- **AND** does not require validation-server copies of the original notes
- **AND** the filter remains enabled after the member reloads the page

#### Scenario: Member selects a community-note location

- **WHEN** a member selects a community-note location
- **THEN** the system displays the location's note thread and available author
  information
- **AND** a reply action opens the Nostroots action options

### Requirement: Batch Nostr author visibility lookup

The system SHALL provide a public read-only endpoint that accepts one or more
valid Nostr public-key hex values and identifies which keys are linked to
Trustroots members and which linked keys are eligible for public display. The
response SHALL NOT disclose why a linked key is ineligible.

#### Scenario: Lookup includes eligible and ineligible authors

- **WHEN** a client requests visibility for public, shadowbanned, and unknown
  Nostr public keys
- **THEN** the response identifies the public and shadowbanned keys as linked
- **AND** includes only the public member's key as eligible
- **AND** does not disclose why the shadowbanned key is ineligible

### Requirement: Profile community notes

The system SHALL show a Nostroots badge and recent original community notes on
a member profile when notes are available for that member's Nostr identity. It
SHALL fetch only kind `30397` events and SHALL NOT fetch kind `30398`
validation-server events.

#### Scenario: Member with community notes has their profile viewed

- **WHEN** a visitor views community notes associated with a member profile
- **THEN** the system fetches and displays only original kind `30397` events
- **AND** does not fetch kind `30398` validation-server copies
