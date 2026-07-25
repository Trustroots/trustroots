## MODIFIED Requirements

### Requirement: Member search

The system SHALL let signed-in members search for other available members and
show an empty state when no members match. Suspended and shadowbanned members
are not available to regular member search.

#### Scenario: Member searches for an available member

- **WHEN** a signed-in member searches using another available member's details
- **THEN** the system displays matching member results

#### Scenario: Member searches for a restricted member

- **WHEN** a signed-in member searches using a suspended or shadowbanned
  member's details
- **THEN** the system displays a no-results state

#### Scenario: Member search has no matches

- **WHEN** a signed-in member searches with no matching members
- **THEN** the system displays a no-results state
