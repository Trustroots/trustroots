# Nostr Integration Specification

## Purpose

Let Trustroots members connect their Nostr identity and discover community
notes through Nostroots while preserving the privacy of non-public profiles.
## Requirements
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

### Requirement: Administrator-curated homepage notes

Trustroots SHALL let administrators feature and remove existing public Nostr kind 1 notes. It SHALL verify a note's event ID and signature before storing it and SHALL use the original event ID to prevent duplicate entries. Featuring SHALL accept a Nostr note or event identifier, a Nostr URI, or a web link containing an event identifier. Trustroots SHALL render the featured note as text on the homepage for signed-in and signed-out visitors, with its original author, publication date and a link to the original note.

#### Scenario: Administrator features a published note

- **WHEN** an administrator supplies a link for an available signed kind 1 note
- **THEN** Trustroots displays the note on the homepage with attribution to its Nostr author
- **AND** featuring the same note again does not duplicate it

#### Scenario: Administrator removes a featured note

- **WHEN** an administrator removes a note from the featured list
- **THEN** the note no longer appears on the homepage

#### Scenario: An unauthorised or invalid request is made

- **WHEN** a non-administrator requests a change, or a feature request contains an invalid signature or non-kind-1 event
- **THEN** Trustroots rejects the request and leaves the featured notes unchanged

### Requirement: Request deletion of a featured Nostr note

Trustroots SHALL let an administrator request deletion of a featured note by signing a NIP-09 kind 5 event with the note's original author key. The deletion request SHALL include the note's event ID and kind. After at least one relay acknowledges publication, Trustroots SHALL verify the signed deletion request against the original author, remove the note content from its featured collection and prevent it from being featured again. The confirmation SHALL explain that relays and clients may retain copies.

#### Scenario: The note author requests deletion

- **WHEN** an administrator confirms the request, the matching signer signs it and a relay acknowledges publication
- **THEN** Trustroots removes the note from the homepage and prevents it from being featured again

#### Scenario: Deletion is not acknowledged

- **WHEN** the signer is unavailable, its key differs from the note author's key, or no relay acknowledges publication
- **THEN** the admin page reports the failure and the homepage keeps showing the note

#### Scenario: A deletion record is retried

- **WHEN** the relay accepted the deletion request and recording it on Trustroots temporarily fails
- **THEN** the administrator can retry saving the signed deletion without publishing a new request

#### Scenario: The administrator removes a note locally

- **WHEN** an administrator uses the homepage removal action
- **THEN** Trustroots removes the homepage copy and allows the note to be featured again
