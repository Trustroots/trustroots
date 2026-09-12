## ADDED Requirements

### Requirement: Angular compatibility during route extraction

The system SHALL use consistent Angular core and companion packages while preserving the remaining Angular pages and their embedded React components during route extraction.

#### Scenario: Member uses an Angular page

- **WHEN** a member opens an existing Angular-owned workflow
- **THEN** navigation, forms and embedded React components retain their existing behaviour

#### Scenario: Subscription update fails

- **WHEN** an account subscription update returns an error
- **THEN** the existing message service displays the failure
- **AND** the update indicator stops
