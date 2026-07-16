## ADDED Requirements

### Requirement: Maps render without WebGL

The system SHALL render an interactive raster map without mounting Mapbox GL
when the browser cannot create a WebGL context.

#### Scenario: Browser blocks WebGL

- **WHEN** a member opens a Trustroots page containing a map and WebGL is
  unavailable
- **THEN** the page displays a Leaflet raster map instead of a blank Mapbox GL
  canvas

#### Scenario: Browser supports WebGL

- **WHEN** a member opens a Trustroots page containing a map and WebGL is
  available
- **THEN** the page continues to use the Mapbox GL map renderer

### Requirement: Fallback map result interaction

The system SHALL preserve essential search-map interactions in the non-WebGL
renderer.

#### Scenario: Member selects a fallback-map offer

- **WHEN** a member selects an individual offer marker in the non-WebGL
  search map
- **THEN** the system opens that offer in the search results sidebar

#### Scenario: Member expands a fallback-map cluster

- **WHEN** a member selects a cluster in the non-WebGL search map
- **THEN** the system zooms to the cluster's expansion level

#### Scenario: Member opens a fallback-map Community Note

- **WHEN** a member selects an individual Community Note marker in the
  non-WebGL search map
- **THEN** the system opens the Community Note thread in the search sidebar
