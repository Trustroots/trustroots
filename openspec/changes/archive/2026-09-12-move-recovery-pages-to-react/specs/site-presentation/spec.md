## ADDED Requirements

### Requirement: React recovery and outcome pages

The system SHALL render `/password/forgot`, `/password/reset/success`, `/password/reset/invalid` and `/confirm-email-invalid` through the existing React application shell and preserve username prefill, recovery submission responses and links into existing authentication workflows.

#### Scenario: Visitor opens a migrated page

- **WHEN** an eligible visitor opens a migrated route
- **THEN** the server renders the React root and assets
- **AND** the page retains its existing content and access rules

#### Scenario: Visitor continues to another workflow

- **WHEN** the visitor follows an onward link or completes a page action
- **THEN** the existing API behaviour and destination remain available
- **AND** Angular-owned destinations load their own application root
