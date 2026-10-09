## MODIFIED Requirements

### Requirement: Map search

The system SHALL let signed-in members search for offers on an interactive map
by location, map bounds, and circle membership. Map navigation SHALL support
pixel-, line-, and page-based mouse wheel input and SHALL allow touch zoom
without touch rotation.

#### Scenario: Member navigates the map

- **WHEN** a member pans or zooms the map, including with line- or page-based
  mouse wheel input
- **THEN** the map updates its visible offers and retains the selected location
- **AND** touch gestures zoom without rotating the map
