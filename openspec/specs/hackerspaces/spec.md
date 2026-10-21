# Hackerspaces

## Purpose

Make community workshops discoverable through source-reported Nostr place events
and a public Hackers circle map, with administrator-reviewed imports.

## Requirements

### Requirement: Public hackerspace place map

The system SHALL display active SpaceAPI-reported physical spaces with coordinates on the public Hackers circle page. Listings SHALL be labelled as not human-verified, and opening state SHALL be labelled as a source-reported snapshot with its fetch time. The page SHALL NOT require sign-in or browser geolocation. The map SHALL be a prominent above-the-fold feature.

#### Scenario: Visitor browses the Hackers circle map

- **WHEN** a visitor opens `/circles/hackers`
- **THEN** the map displays available active place events from the Trustroots Nostr relay
- **AND** the map is a prominent part of the initial page view
- **AND** each place provides its name, available address, website, and source and freshness disclosures

#### Scenario: Place status is displayed

- **WHEN** a place event includes a SpaceAPI opening-state snapshot
- **THEN** the map labels that state as SpaceAPI-reported
- **AND** shows when Trustroots fetched the source data
- **AND** does not describe the status as live or human-verified

#### Scenario: Relay data is unavailable

- **WHEN** the relay cannot be reached or returns no usable place events
- **THEN** the page displays an understandable empty or unavailable state
- **AND** the circle's existing content remains available

### Requirement: Hackerspace discovery resources

The Hackers circle page SHALL provide links to relevant community-maintained
hackerspace directories and explain that listings may be outdated or incomplete.
It SHALL attribute material adapted from the Trustroots Wiki Hackers page under
its CC BY-SA 4.0 licence.
Wiki-derived content SHALL be a reviewed text snapshot with fixed HTTPS links,
attributed to its source revision. Rendering the page SHALL NOT fetch or embed
wiki HTML, scripts, frames or images. Resource links SHALL suppress referrers.

#### Scenario: Visitor explores discovery resources

- **WHEN** a visitor opens the Hackers circle page
- **THEN** the page offers links to HackerspaceWiki, Hackerspace Atlas, SpaceAPI,
  Wikidata and HackspaceUK
- **AND** advises visitors to check a space's own website or contact its members
- **AND** links to the attributed Trustroots Wiki source page

### Requirement: Administrator SpaceAPI import

The system SHALL allow administrators to fetch and preview the SpaceAPI Collector directory and approve eligible place events using a NIP-07 signer. It SHALL use kind `33000` according to the current NIP-41 Places draft, with stable identifiers, addressable updates, geohash ladders and optional Plus Code metadata.

#### Scenario: Administrator previews import changes

- **WHEN** an administrator requests a SpaceAPI refresh
- **THEN** the system shows additions, updates, invalid or unreachable endpoints, retained entries and entries removed from the directory
- **AND** labels imported source data as not human-verified

#### Scenario: Administrator publishes approved import

- **WHEN** the administrator approves the preview and the NIP-07 signer signs the events
- **THEN** the system publishes signed events to the configured Trustroots Nostr relay
- **AND** displays per-event publication progress and outcomes
- **AND** stores no private signing key

#### Scenario: SpaceAPI endpoint is invalid or temporarily unreachable

- **WHEN** a previously imported entry is returned as invalid or unreachable
- **THEN** the system retains its last published place event
- **AND** reports the source problem in the import preview

#### Scenario: Space is removed from SpaceAPI directory

- **WHEN** a previously imported endpoint no longer appears in the full directory response
- **THEN** an administrator-approved refresh marks its addressable event inactive
- **AND** does not delete the event

#### Scenario: SpaceAPI Collector is unavailable

- **WHEN** the Collector cannot be fetched or its response is invalid
- **THEN** the system reports an import error
- **AND** does not change any published event

### Requirement: Shared relay publication

Administrator-approved place events SHALL be signed once and published to both
`wss://relay.trustroots.org` and `wss://relay.nomadwiki.org`. The import UI SHALL
report each relay's outcomes independently and close publication connections
after the import. One unavailable relay SHALL NOT prevent publication to the other.

#### Scenario: Both relays accept a place

- **WHEN** a signer approves a place event and both relays accept it
- **THEN** the same signed event is sent to both relays
- **AND** both successful results are displayed

#### Scenario: One relay is unavailable

- **WHEN** one relay cannot connect or rejects publication
- **THEN** publication continues to the other relay
- **AND** the UI distinguishes their outcomes

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

### Requirement: Exclude closed spaces

Spaces with a closed SpaceAPI opening-state snapshot SHALL be excluded from the circle map and active import publication. A refresh SHALL skip closed additions and retire previously active closed entries through an inactive addressable update so old events stop appearing. Website links SHALL show the URL as their label.

#### Scenario: Closed space appears in a refresh

- **WHEN** the SpaceAPI collector reports state.open as false
- **THEN** the preview excludes the space from active additions and updates
- **AND** a previously active event is replaced by an inactive event after administrator approval
- **AND** the map filters existing closed snapshots

### Requirement: Compact Hackers circle layout

The Hackers circle SHALL place wiki resources and member discovery side by side on desktop and stack them on small screens. The Circle Wiki action SHALL appear with the attributed resources. Both map circle headers SHALL use a compact hero with a fading photo background so following content can appear in the initial desktop viewport.

#### Scenario: Member browses the Hackers circle on desktop

- **WHEN** a circle member opens the Hackers circle
- **THEN** the wiki resources and member groups share the space below the map hero
- **AND** the Circle Wiki button appears beside the resource attribution

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

The admin importer SHALL skip new listings whose structured or legacy address identifies Russia, Israel or Belarus, accepting country names and ISO alpha-2/alpha-3 codes case-insensitively. It SHALL prepare kind 5 deletion requests for existing excluded listings from either configured relay, including event ID, addressable identifier and kind tags. It SHALL sign a deletion request only with the original author key and report mismatches. Public map parsing SHALL remain unchanged.

#### Scenario: Excluded country appears in a refresh

- **WHEN** a collector listing identifies Russia, Israel or Belarus
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
