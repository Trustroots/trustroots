## ADDED Requirements

### Requirement: Account access deployed version
The system SHALL display the deployed build date and commit link on signin, signup, password recovery/reset and not-found pages when build metadata is available.

#### Scenario: Visitor diagnoses account access
- **WHEN** a visitor opens an account access page with build metadata available
- **THEN** a compact footer exposes the deployed date and commit

### Requirement: Login route alias
The system SHALL redirect /login to /signin while preserving query parameters.

#### Scenario: Visitor uses the login alias
- **WHEN** a visitor requests /login with a returnTo query parameter
- **THEN** the visitor is redirected to /signin with the same parameter
