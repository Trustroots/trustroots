## ADDED Requirements

### Requirement: React contact creation

The system SHALL render `/contact-add/:userId` through the existing React application shell while preserving authentication, profile activation, editable contact messages and existing contact outcomes.

#### Scenario: Member creates a connection

- **WHEN** an activated member opens another member's contact-add page
- **THEN** the page checks the recipient and existing connection before offering submission
- **AND** the edited message is submitted through the existing contact API
- **AND** success and duplicate responses retain their existing meaning

#### Scenario: A connection cannot be offered

- **WHEN** the visitor is unauthenticated, inactive, the recipient is missing, or the recipient is the same member
- **THEN** the existing sign-in, activation or explanatory response is shown
- **AND** no contact creation form is offered

#### Scenario: Member follows a profile link

- **WHEN** the member cancels or follows an onward profile link
- **THEN** the existing Angular-owned profile workflow loads its application root

### Requirement: React experience writing

The system SHALL render `/profile/:username/experiences/new` in the React shell using the existing experience form, recipient profile and experiences feature setting, with links back to the existing profile and experience history.

#### Scenario: Member shares an experience

- **WHEN** a signed-in member opens a recipient's experience-writing URL with experiences enabled
- **THEN** the recipient is loaded through the existing profile API
- **AND** the existing interaction, recommendation, feedback and submission workflow is available
- **AND** duplicate and self-experience outcomes remain available

#### Scenario: Experience writing is unavailable

- **WHEN** experiences are disabled or the recipient cannot be loaded
- **THEN** no experience submission form is displayed
- **AND** the page provides a return link or an explanatory error
