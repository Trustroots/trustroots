## ADDED Requirements

### Requirement: Shared web design tokens

The web client SHALL expose existing brand and text colours, surfaces, typography,
component padding, radii and notification badge colour as `--tr-*` root CSS custom
properties derived from the existing Less variables. The initial token bridge
SHALL preserve the current appearance and be included in LTR and RTL stylesheets.

#### Scenario: CSS and React consumers share notification colour

- **WHEN** the web client renders a notification badge
- **THEN** its React styling uses the shared notification background token
- **AND** the resolved colour matches the existing Less notification colour

#### Scenario: Direction-independent token availability

- **WHEN** a member opens the client in an LTR or RTL language
- **THEN** the root design tokens are available to CSS and TSX styles
- **AND** the existing brand colours and component dimensions are preserved
