# hitchhiking Specification

## Purpose

Help visitors to the Hitchhikers circle discover recently reported hitchhiking origins through Hitchwiki's Nostr feed, with clear dates and attribution, using shared circle map infrastructure.

## Requirements

### Requirement: Recent Hitchwiki origin map

The public Hitchhikers circle SHALL prominently display valid ride origins from the previous seven days, read from Hitchwiki's Nostr relay without sign-in or geolocation. It SHALL use recorded origin time, falling back to submission time when unknown, and SHALL disclose that distinction and the source. Event update time SHALL NOT make an old ride recent.

#### Scenario: Visitor browses recent locations

- **WHEN** a visitor opens `/circles/hitchhikers`
- **THEN** the map displays eligible kind 36820 origin locations from the documented Hitchwiki publisher
- **AND** popups show their recorded or submitted date, approximate-location disclosure when relevant and a source ride link
- **AND** the map attributes Hitchwiki Maps and its ODbL database

#### Scenario: Records change

- **WHEN** replacement or author-signed deletion events arrive
- **THEN** only the latest non-deleted version of each addressable ride is displayed
- **AND** invalid, future and expired locations are excluded

#### Scenario: Relay returns no usable locations or fails

- **WHEN** the subscription completes without eligible rides or the relay fails
- **THEN** the page displays an explicit empty or unavailable state
- **AND** the remaining circle content stays available

### Requirement: Shared circle map presentation

Hitchhiking and hackerspace circle maps SHALL share map rendering, safe text popup construction, responsive styling and subscription lifecycle handling.

#### Scenario: Visitor changes circle

- **WHEN** a map unmounts, including while its connection is pending
- **THEN** its subscription and map resources are released
- **AND** both circle maps retain their source-specific disclosures

### Requirement: Concise Hitchwiki ride details

The Hitchhikers circle SHALL include only records whose source is maps.hitchwiki.org. Popups SHALL show available waiting time, distance, signal methods, submission time and reasons for hitchhiking using concise labelled values. Missing values SHALL be omitted. The map footer SHALL combine the count, past-seven-day period and source credits.

#### Scenario: Visitor inspects a recent ride

- **WHEN** a visitor opens an eligible ride popup
- **THEN** the available ride details and source link are shown safely as text
- **AND** Hitchmap and other source records are excluded

### Requirement: Circle map navigation and styling

Both circle maps SHALL support pinch and mouse-wheel zoom, constrain zoom and panning to keep world tiles filling the frame, and use Trustroots link colours including hover and keyboard focus. Circle header actions SHALL have a compact, consistent layout.

#### Scenario: Visitor navigates either circle map

- **WHEN** a visitor pinches, scrolls or zooms out on a circle map
- **THEN** zoom responds and stops before empty space can appear outside the world
- **AND** map credits and popup links remain readable on hover and focus
