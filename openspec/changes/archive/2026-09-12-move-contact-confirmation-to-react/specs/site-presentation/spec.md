## ADDED Requirements

### Requirement: React contact confirmation

The system SHALL render `/contact-confirm/:contactId` through the existing React application shell and preserve member-only access, recipient checks, missing or confirmed requests and confirmation submission.

#### Scenario: Visitor opens a migrated page

- **WHEN** an eligible visitor opens a migrated route
- **THEN** the server renders the React root and assets
- **AND** the page retains its existing content and access rules

#### Scenario: Visitor continues to another workflow

- **WHEN** the visitor follows an onward link or completes a page action
- **THEN** the existing API behaviour and destination remain available
- **AND** Angular-owned destinations load their own application root
