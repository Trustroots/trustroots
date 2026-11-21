## ADDED Requirements

### Requirement: Existing circle edits save automatically

The circle editor SHALL automatically persist valid edits to an existing circle, including metadata, image selection and organiser assignments. The editor SHALL show the save state and keep failed edits available for retry. New circles SHALL require an explicit creation action.

#### Scenario: An administrator edits an existing circle

- **WHEN** an administrator makes a valid edit in an existing circle's editor
- **THEN** the system saves the edit automatically and confirms when the save completes
- **AND** a reload shows the persisted edit

#### Scenario: A save fails

- **WHEN** an automatic save fails
- **THEN** the editor displays the error and retains the edit for retry

#### Scenario: An administrator drafts a new circle

- **WHEN** an administrator edits the new circle form
- **THEN** the system creates the circle only after explicit submission

## MODIFIED Requirements

### Requirement: Administrators manage circle organisers

The circle editor SHALL let site administrators assign or remove consenting Trustroots members as organisers on new and existing circles. The system SHALL store assignments by stable member ID. The editor SHALL display each organiser with a member account as a member card linked to its profile, with a separate removal control. A deleted account SHALL remain removable.

#### Scenario: Administrator updates organisers on an existing circle

- **WHEN** a site administrator adds or removes an organiser
- **THEN** the updated list is persisted automatically, including when the save also uploads an image
- **AND** the administrator can clear the entire list

#### Scenario: Administrator attempts an invalid assignment

- **WHEN** an administrator submits a duplicate or unknown new member ID
- **THEN** the system rejects the organiser change

#### Scenario: An assigned member changes username

- **WHEN** an organiser changes username
- **THEN** the assignment continues to refer to the same member

#### Scenario: An administrator views circle organisers

- **WHEN** the editor lists an organiser with a member account
- **THEN** its card links to the organiser's profile and offers a separate Remove action
