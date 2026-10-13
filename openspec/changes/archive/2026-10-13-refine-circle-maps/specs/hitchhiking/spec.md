## ADDED Requirements

### Requirement: Concise Hitchwiki ride details

The Hitchhikers circle SHALL include only records whose source is maps.hitchwiki.org. Popups SHALL show available waiting time, distance, signal methods, submission time and reasons for hitchhiking using concise labelled values. Missing values SHALL be omitted. The map footer SHALL combine the count, past-seven-day period and source credits.

#### Scenario: Visitor inspects a recent ride

- **WHEN** a visitor opens an eligible ride popup
- **THEN** the available ride details and source link are shown safely as text
- **AND** Hitchmap and other source records are excluded

### Requirement: Circle map navigation and styling

Both circle maps SHALL support pinch and mouse-wheel zoom, constrain zoom and panning to keep world tiles filling the frame, and use Trustroots link colours including hover and keyboard focus. Circle header actions SHALL have a compact, consistent layout.

#### Scenario: Visitor navigates either circle map

- **WHEN** a visitor pinches, scrolls or zooms out on a circle map
- **THEN** zoom responds and stops before empty space can appear outside the world
- **AND** map credits and popup links remain readable on hover and focus
