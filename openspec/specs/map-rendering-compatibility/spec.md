# map-rendering-compatibility Specification

## Purpose

Keep the React map integration aligned with its renderer, preserve essential
map interactions, and explain when a browser cannot show a map.

## Requirements

### Requirement: Aligned WebGL map integration

The system SHALL render its React maps with a single installed MapLibre GL JS version, its stylesheet and TypeScript definitions, using the OpenFreeMap style without an access token. Map search, offer-location and circle maps SHALL keep their navigation, selection, clustering and location-editing interactions. Map rendering SHALL depend on WebGL2 availability rather than browser names or user-agent strings.

#### Scenario: Member uses a browser supporting WebGL2

- **WHEN** a member opens map search, an offer-location map or a circle map in a browser supporting WebGL2
- **THEN** the map renders with MapLibre GL JS and the OpenFreeMap style
- **AND** existing map interactions remain available

#### Scenario: Chromium browser supports WebGL2

- **WHEN** a member opens map search in Chrome, Brave or Edge with WebGL2 available
- **THEN** the system renders the map rather than excluding the browser by name

#### Scenario: Member uses a browser without WebGL2

- **WHEN** a member opens map search, an offer-location map or a circle map without WebGL2
- **THEN** the system shows a notice where the map would be, explaining that WebGL is not available
- **AND** the rest of the page remains usable
