## ADDED Requirements

### Requirement: Map location controls and approximate fallback

Search, shared hosting/meeting editors, and hackers and hitchhikers circle maps SHALL offer an accessible location icon over the map. Activating it SHALL request device location once and, on failure, try the existing authenticated GeoIP lookup. A successful fallback SHALL clearly announce its approximate nature and use the returned coarse zoom. Pending requests SHALL be deduplicated and stale callbacks ignored.

#### Scenario: Device permission is denied

- **WHEN** the member activates the map icon and device location fails
- **THEN** an available GeoIP result centres the map at its approximate viewport
- **AND** search preserves filters and uses existing viewport persistence
- **AND** the control announces that the location is approximate

#### Scenario: Approximate offer editor navigation

- **WHEN** an offer editor receives an approximate fallback
- **THEN** only its viewport changes, including when an existing location is selected
- **AND** the selected offer coordinates remain unchanged until explicit manual or precise device selection
- **AND** saving remains explicit

#### Scenario: Neither source is available

- **WHEN** device location fails and GeoIP yields no location
- **THEN** actionable device-location feedback and manual navigation remain available

#### Scenario: Circle map relay results arrive late

- **WHEN** a member activates location while circle markers are loading
- **THEN** subsequent relay results do not replace the chosen viewport
