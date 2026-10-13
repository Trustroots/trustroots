## ADDED Requirements

### Requirement: Exclude closed spaces

Spaces with a closed SpaceAPI opening-state snapshot SHALL be excluded from the circle map and active import publication. A refresh SHALL skip closed additions and retire previously active closed entries through an inactive addressable update so old events stop appearing. Website links SHALL show the URL as their label.

#### Scenario: Closed space appears in a refresh

- **WHEN** the SpaceAPI collector reports state.open as false
- **THEN** the preview excludes the space from active additions and updates
- **AND** a previously active event is replaced by an inactive event after administrator approval
- **AND** the map filters existing closed snapshots

### Requirement: Compact Hackers circle layout

The Hackers circle SHALL place wiki resources and member discovery side by side on desktop and stack them on small screens. The Circle Wiki action SHALL appear with the attributed resources. Both map circle headers SHALL use a compact hero with a fading photo background so following content can appear in the initial desktop viewport.

#### Scenario: Member browses the Hackers circle on desktop

- **WHEN** a circle member opens the Hackers circle
- **THEN** the wiki resources and member groups share the space below the map hero
- **AND** the Circle Wiki button appears beside the resource attribution
