## ADDED Requirements

### Requirement: Administrators manage circle organisers

The circle editor SHALL let site administrators assign or remove consenting Trustroots members as organisers on new and existing circles. The system SHALL store assignments by stable member ID.

#### Scenario: Administrator updates organisers on an existing circle

- **WHEN** a site administrator adds or removes an organiser and saves the circle
- **THEN** the updated list is persisted, including when the save also uploads an image
- **AND** the administrator can clear the entire list

#### Scenario: Administrator attempts an invalid assignment

- **WHEN** an administrator submits a duplicate or unknown new member ID
- **THEN** the system rejects the organiser change

#### Scenario: An assigned member changes username

- **WHEN** an organiser changes username
- **THEN** the assignment continues to refer to the same member
