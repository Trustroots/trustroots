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

### Requirement: Shared circle map view

The hackers and hitchhikers circle maps SHALL restore the centre and zoom chosen on either map during the same browser session. When no view has been chosen, a map SHALL fit its initial results as before.

#### Scenario: Visitor switches circle maps

- **WHEN** a visitor pans or zooms one circle map and opens the other circle map in the same browser session
- **THEN** the other map shows the chosen centre and zoom
- **AND** incoming results do not reset that view

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

### Requirement: Hitchhiker names in ride popups

Ride popups SHALL show available non-empty hitchhiker nicknames before waiting time, preserving feed order and removing duplicate names. Named riders SHALL link directly to their Hitchwiki Maps account at `https://maps.hitchwiki.org/account/<nickname>`, with the nickname URL-encoded. Anonymous SHALL be plain text without a profile link. Missing and malformed names SHALL be omitted. Labels SHALL render safely as text, without gender symbols.

#### Scenario: Visitor inspects named and anonymous riders

- **WHEN** a visitor clicks an eligible ride origin containing named and Anonymous hitchhikers
- **THEN** the popup shows their names and links only named hitchhikers
- **AND** existing ride facts and the source ride link remain available

#### Scenario: Direct Maps account links

- **WHEN** a visitor opens a ride popup containing a named hitchhiker
- **THEN** their name links directly to the Hitchwiki Maps account
- **AND** no wiki user-page lookup is required
