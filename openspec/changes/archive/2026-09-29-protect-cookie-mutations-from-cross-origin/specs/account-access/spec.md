## MODIFIED Requirements

### Requirement: Sign-out

The system SHALL end an account holder's session only after a same-origin
state-changing sign-out request, and SHALL accept sign-out through POST.

#### Scenario: Account holder signs out

- **WHEN** an account holder submits a same-origin POST sign-out request
- **THEN** the system clears their session
- **AND** member-only routes require them to sign in again

#### Scenario: Browser submits a cross-origin state-changing account request

- **WHEN** a state-changing request includes a foreign `Origin` or
  non-same-origin Fetch Metadata value
- **THEN** the system rejects it without applying the mutation

#### Scenario: Legacy client omits browser-origin metadata

- **WHEN** a state-changing request omits both `Origin` and Fetch Metadata
- **AND** the request uses JSON content or includes the dedicated request
  header
- **THEN** the system preserves existing API compatibility
- **AND** the request remains outside this bounded browser-origin mitigation

#### Scenario: Originless API request has no JSON content or request marker

- **WHEN** an API mutation omits both browser-origin signals and has neither
  JSON content nor the dedicated request header
- **THEN** the system rejects it without applying the mutation

#### Scenario: Client requests sign-out with GET

- **WHEN** a client requests the sign-out endpoint with GET
- **THEN** the system does not end the account holder's session
