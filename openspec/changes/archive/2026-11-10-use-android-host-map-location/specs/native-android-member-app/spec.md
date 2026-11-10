## ADDED Requirements

### Requirement: Android host map device location

The Android host map SHALL offer an explicit Use my location action. It SHALL request foreground location access only after activation and use a bounded, one-time lookup through Android platform providers. The device location SHALL be used as a map-search input only. Sharing location in a message requires a separate explicit action with a preview before sending.

#### Scenario: Device location is available

- **WHEN** the member taps Use my location, grants foreground access and Android returns a position
- **THEN** the app centres the map on that position and refreshes nearby hosts using the active filters
- **AND** the app indicates when the position is approximate

#### Scenario: Device location cannot be obtained

- **WHEN** permission is denied, location is unavailable, or the request times out
- **THEN** the app shows a status message and leaves the current map position intact
- **AND** the member can still search or pan the map
