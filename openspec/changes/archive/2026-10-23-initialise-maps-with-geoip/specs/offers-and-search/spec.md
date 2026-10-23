## ADDED Requirements

### Requirement: Approximate initial map viewport

The system SHALL initialise fresh search, hosting and meeting maps using an
approximate IP-derived viewport when no higher-priority location applies.
Search SHALL prefer explicit destinations over a recent saved search viewport,
then GeoIP, then the existing default. Offer editors SHALL prefer existing
offer coordinates over GeoIP, then the existing default, and SHALL NOT inherit
the saved search viewport. GeoIP SHALL only centre the viewport and SHALL NOT
select or save an offer location.

#### Scenario: Member opens a fresh search map

- **WHEN** a member opens search without an explicit destination or recent saved viewport
- **AND** an approximate location is available
- **THEN** the map starts at that approximate viewport
- **AND** no browser geolocation permission is requested

#### Scenario: Member opens an explicit destination

- **WHEN** a member opens an explicit search location, bounds or offer deep link
- **THEN** the map uses that destination regardless of saved or IP-derived locations

#### Scenario: Member edits an existing offer

- **WHEN** a member opens an offer with saved coordinates
- **THEN** the editor shows those coordinates regardless of GeoIP or search history

#### Scenario: Member creates an offer

- **WHEN** a member opens a new hosting or meeting editor and GeoIP is available
- **THEN** its initial viewport uses the approximate location without choosing a marker
- **AND** the member must explicitly select a location before saving
- **AND** initialisation, zoom-only events and programmatic moves do not select a location

#### Scenario: Member acts before lookup completes

- **WHEN** a member searches, pans, zooms or selects a location before the GeoIP response arrives
- **THEN** the response does not move the map or change the selected offer location

#### Scenario: Lookup is unavailable

- **WHEN** the database is disabled, missing or unusable, the address has no usable result, or the request fails
- **THEN** the map remains usable with its next applicable fallback

### Requirement: Recent saved search viewport

The system SHALL restore a valid saved search viewport only when it was changed
by the member less than 48 hours ago. Only deliberate member viewport changes
SHALL refresh its timestamp. Invalid or legacy untimestamped records SHALL be
treated as absent. Storage failures SHALL NOT prevent map use.

#### Scenario: Member returns within 48 hours

- **WHEN** a member returns to search without an explicit destination and has a valid recent saved viewport
- **THEN** the map restores that viewport in preference to GeoIP
- **AND** restoration alone does not refresh its timestamp

#### Scenario: Saved viewport expires or cannot be trusted

- **WHEN** a saved viewport is at least 48 hours old, future-dated, malformed or untimestamped
- **THEN** it is ignored and cleared where storage is available
- **AND** the map uses GeoIP or the existing default

#### Scenario: Storage is unavailable

- **WHEN** browser storage cannot be read or written
- **THEN** the member can still use and navigate the map

### Requirement: Local and isolated approximate location lookup

The system SHALL resolve the current authenticated request's trusted client
address using a locally provisioned database. It SHALL NOT send visitor IPs to
an external lookup service or expose visitor-specific results through shared
application settings. Responses SHALL be private and non-cacheable and SHALL
contain only an approximate viewport or a null location. Approximate coordinates
SHALL be rounded to whole degrees, with zoom no greater than 6 and widened for
the reported accuracy radius. Invalid and non-public addresses SHALL yield no
location. GeoIP results SHALL NOT be stored in member or offer records.

#### Scenario: Separate members request defaults concurrently

- **WHEN** authenticated requests from different trusted client addresses overlap
- **THEN** each response contains only its own approximate location or null
- **AND** shared settings do not retain either location
- **AND** each response carries private/no-store cache controls

#### Scenario: Client supplies an ordinary forwarding header

- **WHEN** a request supplies an untrusted forwarding header
- **THEN** it does not override the address selected by the existing client-IP helper

#### Scenario: Database is not configured

- **WHEN** the application starts without a configured GeoIP database path
- **THEN** no database is loaded and authenticated lookup returns a null location
- **AND** application startup and map use continue normally

#### Scenario: Anonymous caller requests a default

- **WHEN** an unauthenticated caller requests the default-location endpoint
- **THEN** the existing API authentication policy rejects the request
