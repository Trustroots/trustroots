# map-rendering-compatibility Specification

## Purpose

Keep the React map integration aligned with its renderer and preserve essential
map interactions in browsers with and without WebGL2.

## Requirements

### Requirement: Aligned WebGL map integration

The system SHALL use a single installed Mapbox GL JS version for its React
maps, stylesheet and TypeScript definitions. Map search and offer-location
maps SHALL retain their existing styles, navigation, selection, clustering
and location-editing interactions after a renderer upgrade.
Map search SHALL select its renderer by Mapbox token and WebGL2 availability rather than browser
names or user-agent strings.

#### Scenario: Member uses the upgraded WebGL map

- **WHEN** a member opens a map with a configured Mapbox token in a browser supporting WebGL2
- **THEN** the React integration renders using Mapbox GL JS v3
- **AND** existing map interactions remain available

#### Scenario: Chromium browser supports WebGL2

- **WHEN** a member opens map search in Chrome, Brave or Edge with a configured Mapbox token and WebGL2 available
- **THEN** the system uses Mapbox GL JS rather than excluding the browser by name

#### Scenario: Member uses a browser without WebGL2

- **WHEN** a member opens map search or an offer-location map without WebGL2
- **THEN** the system selects the existing interactive Leaflet raster renderer
- **AND** essential map interactions remain available

#### Scenario: Installation has no Mapbox token

- **WHEN** a member opens map search or an offer-location map without a configured Mapbox token
- **THEN** the system uses the existing interactive Leaflet renderer with OpenStreetMap tiles
- **AND** the fallback remains usable with WebGL2 available and a saved Mapbox style
