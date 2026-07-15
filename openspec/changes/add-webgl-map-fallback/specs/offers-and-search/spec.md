## MODIFIED Requirements

### Requirement: Map search

The system SHALL let signed-in members search for offers on a map by location,
map bounds, and circle membership, including when the browser cannot create a
WebGL context.

#### Scenario: Member searches within a map area

- **WHEN** a signed-in member searches within a map area
- **THEN** the system displays matching offers in that area

#### Scenario: Member filters map results by circle

- **WHEN** a signed-in member applies a circle filter
- **THEN** the system displays offers matching that circle

#### Scenario: Member searches without WebGL

- **WHEN** a signed-in member opens map search in a browser without WebGL
- **THEN** the system provides an interactive raster map with the matching
  offers
