## ADDED Requirements

### Requirement: Administration, offers and search client code use TypeScript

The project SHALL implement administration, offers and search client modules in strict TypeScript while preserving existing runtime behaviour and client test coverage.

#### Scenario: Administration, offers or search code is type-checked

- **WHEN** the client TypeScript type-check runs
- **THEN** administration, offers and search client modules are included in the strict check
- **AND** those modules contain no unchecked JavaScript implementations

#### Scenario: Administration, offers or search code is covered by client tests

- **WHEN** the client test suite and coverage run
- **THEN** the migrated modules remain exercised by their existing tests
- **AND** the established client coverage thresholds remain satisfied
