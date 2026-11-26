## ADDED Requirements

### Requirement: Regular iOS profile uses a shared identity header

The regular iOS profile SHALL display the member's identity and tagline in
Compose. It SHALL use the existing iOS avatar source and preserve the background
artwork. When present, Back SHALL occupy a separate row above the avatar.

#### Scenario: Read a member profile opened from Search

- **GIVEN** a member opens a profile from a Search host card
- **WHEN** the profile loads
- **THEN** the avatar, identity and tagline are visible below Back
- **AND** Back returns to the host card
