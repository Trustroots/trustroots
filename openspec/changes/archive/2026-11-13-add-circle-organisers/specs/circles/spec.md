## ADDED Requirements

### Requirement: Circle organisers

The system SHALL show linked organiser names on the web circle detail page to signed-in members who can view the circle and the listed profiles. The organiser designation SHALL grant no permissions and SHALL be independent of circle membership.

#### Scenario: Signed-in member views a circle with organisers

- **WHEN** a signed-in member opens a circle with eligible organisers
- **THEN** the circle page shows the organisers' current names linked to their profiles
- **AND** joining or leaving the circle preserves the organiser section

#### Scenario: Organisers are unavailable to the viewer

- **WHEN** a guest opens a circle or a signed-in viewer has no eligible organisers to see
- **THEN** the page omits the organiser section
- **AND** the detail API omits organiser identities the viewer cannot access

#### Scenario: Organiser identities are scoped to circle details

- **WHEN** a client requests the circle catalogue or a circle membership payload
- **THEN** the response excludes organiser assignments
