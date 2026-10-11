## ADDED Requirements

### Requirement: Browser-facing message offer and profile contracts

The project SHALL share strict request and response contracts between browser-facing messages, offers and profile client APIs and checked JavaScript server payload builders, preserving existing HTTP shapes, validation and privacy rules.

#### Scenario: An implementation drifts from its contract

- **WHEN** a checked request or response builder constructs an incompatible field
- **THEN** the blocking type-check command fails

#### Scenario: Responses vary by visibility or endpoint

- **WHEN** clients consume deleted message participants, offer GeoJSON or public and own profiles
- **THEN** their types represent the actual response variants and omitted private fields
- **AND** runtime sanitisation and location privacy remain unchanged

#### Scenario: Message pagination uses native URL parsing

- **WHEN** a message response supplies a Link header
- **THEN** the client extracts the next relation's query parameters without a third-party Link-header parser
- **AND** relative and absolute links, repeated query values, absent next links and the existing 2,000-character limit retain their behaviour

### Requirement: All client tests use strict TypeScript

All module client tests and client-specific test utilities SHALL use TypeScript and be included in strict checking, linting and existing test discovery, without reducing assertions or coverage.

#### Scenario: A test fixture or mock violates a contract

- **WHEN** strict test type-checking runs
- **THEN** incompatible typed fixtures and mocks fail checking without blanket diagnostic suppressions

#### Scenario: The migrated suite runs

- **WHEN** the client tests and coverage run
- **THEN** all previous scenarios remain discoverable and covered
- **AND** established client and server coverage requirements remain satisfied
