## ADDED Requirements

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
