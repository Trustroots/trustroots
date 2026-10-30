## ADDED Requirements

### Requirement: Explicit web device location

The web client SHALL offer an accessible “Use my location” action on map search and shared hosting/meeting location editors. It SHALL request device location only after member activation, using a one-shot request with a 15-second timeout, no cached position and default accuracy. It SHALL prevent duplicate pending requests and ignore callbacks after unmount. Coordinates SHALL be finite and within latitude/longitude bounds, including valid zero values.

#### Scenario: Member centres search on their device

- **WHEN** a member activates the action and the browser returns valid coordinates
- **THEN** search centres on those coordinates at zoom 13 in either map renderer
- **AND** clears the previous place query, bounds and offer/community-note selection while preserving search filters
- **AND** uses existing search viewport persistence without publishing a member location

#### Scenario: Member selects an offer location using their device

- **WHEN** a member successfully activates the action in a hosting or meeting editor
- **THEN** the editor selects editable coordinates through its existing location-change flow
- **AND** persists them only when the member saves, retaining existing public-location randomisation

#### Scenario: Device location fails

- **WHEN** permission is denied, location is unavailable, the request times out, coordinates are invalid or the browser does not support geolocation
- **THEN** the action presents accessible, actionable feedback and permits retry
- **AND** manual place search and map selection remain available without changing the selected location

#### Scenario: Approximate defaults arrive after explicit navigation

- **WHEN** the member activates device location while a GeoIP lookup is pending
- **THEN** delayed approximate defaults do not override subsequent device-location navigation

#### Scenario: Member has not requested location

- **WHEN** the member opens search or an offer editor without activating the action
- **THEN** the client does not request browser geolocation or start location tracking
