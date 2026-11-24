## MODIFIED Requirements

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
- **THEN** the system loads an interactive Leaflet renderer with OpenStreetMap raster tiles, only for that browser
- **AND** search, selection, clustering and location editing remain available
- **AND** an analytics event without personal data records that the fallback was used
