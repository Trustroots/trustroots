## ADDED Requirements

### Requirement: Regular iOS support uses the shared form

The regular iOS support destination SHALL use shared Compose for its message
form, delivery feedback and FAQ action. It SHALL use the existing authenticated
iOS support client and bounded FAQ browser route.

#### Scenario: Retry a support message after a failed send

- **GIVEN** a signed-in member has written a support message
- **WHEN** delivery fails
- **THEN** the form displays the error and keeps the message available for retry
- **AND** after a successful retry it clears the draft and confirms delivery

#### Scenario: Open the FAQ from support

- **GIVEN** a member is using the support form
- **WHEN** they choose to browse frequently asked questions
- **THEN** the app opens the existing FAQ browser route
