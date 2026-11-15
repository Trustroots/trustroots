## ADDED Requirements

### Requirement: Consistent member identity previews

The web, Android and iOS clients SHALL present a member's avatar, display name and username in a consistent order on member-facing previews and profile identities. Previews SHALL use an avatar fallback and respect existing member visibility and navigation rules.

#### Scenario: A member has a display name and username

- **WHEN** a member preview has both names
- **THEN** the preview shows the display name followed by the username prefixed with `@`
- **AND** the avatar uses the available photo or initials

#### Scenario: A preview has incomplete identity data

- **WHEN** the display name or username is missing
- **THEN** the preview uses the available username as its primary label or a generic member label if both names are missing
- **AND** it exposes a profile control only when the profile route is available and allowed

#### Scenario: A desktop grid gives a member card limited width

- **WHEN** the circle member grid or a larger text setting constrains a member card
- **THEN** the card keeps a fixed-size avatar, wraps the identity text beside it, and gives long metadata the full card width
- **AND** the grid uses a single card per row when it cannot fit multiple readable cards

#### Scenario: A preview appears on an actionable screen

- **WHEN** a member preview is displayed alongside offer, contact or conversation actions
- **THEN** the screen keeps those actions independently available and labels any separate profile control
