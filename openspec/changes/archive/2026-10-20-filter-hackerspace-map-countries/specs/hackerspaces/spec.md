## ADDED Requirements

### Requirement: Visible signing identity

The admin importer SHALL require connecting a NIP-07 signer before publication and display its npub and matching trustroots.org NIP-05 identity. An administrator-only endpoint SHALL validate the public key and query MongoDB for the corresponding stored npub using the public account eligibility rules of the existing NIP-05 endpoint. It SHALL return only the identity, not other member data. It SHALL NOT query relay profiles or external NIP-05 domains. A missing identity or failed lookup SHALL be clearly distinguished and SHALL NOT prevent use of the public key. Deletion previews SHALL display author npubs and whether they match the connected signer. Publication SHALL stop if the extension changes its key after connection and SHALL NOT publish events signed with a different key.

#### Scenario: Administrator connects a signer

- **WHEN** an administrator connects the browser signer
- **THEN** the page shows its npub before requesting any signatures
- **AND** shows the matching trustroots.org identity from MongoDB, if eligible

#### Scenario: Signing key changes

- **WHEN** the extension switches to another key before or during publication
- **THEN** the changed key is not silently used to publish events
- **AND** the administrator must reconnect and review the identity

### Requirement: Sortable import preview

The admin preview SHALL allow ascending and descending sorting by Space, Location, Preview action and Website using keyboard-accessible column buttons. Headers SHALL expose the current direction to assistive technology. Sorting SHALL NOT alter the publication plan.

#### Scenario: Administrator sorts preview rows

- **WHEN** an administrator selects a column header
- **THEN** rows sort by that column's displayed value
- **AND** selecting it again reverses the sort direction

### Requirement: Country exclusions in admin imports

The admin importer SHALL skip new listings whose structured or legacy address identifies Russia or Israel, accepting country names and ISO alpha-2/alpha-3 codes case-insensitively. It SHALL prepare kind 5 deletion requests for existing excluded listings from either configured relay, including event ID, addressable identifier and kind tags. It SHALL sign a deletion request only with the original author key and report mismatches. Public map parsing SHALL remain unchanged.

#### Scenario: Excluded country appears in a refresh

- **WHEN** a collector listing identifies Russia or Israel
- **THEN** it is excluded from new active publication
- **AND** matching existing events are included in deletion requests after administrator approval

#### Scenario: Existing listing has disappeared from the collector

- **WHEN** a relay listing identifies an excluded country but is absent from the collector
- **THEN** it is still included in deletion requests

#### Scenario: Another author published a listing

- **WHEN** the signer differs from the original author
- **THEN** no deletion request for that listing is signed
- **AND** the importer reports that the original author key is required

#### Scenario: Country is unknown

- **WHEN** country information is absent
- **THEN** existing import eligibility rules apply
