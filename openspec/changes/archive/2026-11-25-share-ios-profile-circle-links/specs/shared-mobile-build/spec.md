## ADDED Requirements

### Requirement: Regular iOS profile uses shared Circle links

The regular iOS profile SHALL display the member's joined Circle links in
Compose and use the current width to wrap them. Selecting a Circle SHALL
open the existing Circle detail route.

#### Scenario: Open a Circle from a member profile

- **GIVEN** a regular iOS profile has a joined Circle
- **WHEN** the viewer opens the Circle from the profile
- **THEN** the Circle detail opens and Back returns to the member profile
