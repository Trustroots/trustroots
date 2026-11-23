## ADDED Requirements

### Requirement: Record safety page visits

The system SHALL record a private visit flag for a signed-in member who opens the web safety page. The flag SHALL persist across sessions and record only that the page was opened.

#### Scenario: A signed-in member opens the safety page

- **WHEN** a signed-in member opens `/safety`
- **THEN** the system marks that member's account as having visited the safety page
- **AND** repeat visits leave the member marked as having visited

#### Scenario: A visitor opens the safety page

- **WHEN** someone who is signed out opens `/safety`
- **THEN** the guidance is available
- **AND** no account visit is recorded

#### Scenario: The visit cannot be recorded

- **WHEN** the visit request fails
- **THEN** the guidance remains available to the member
