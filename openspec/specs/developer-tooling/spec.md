# developer-tooling Specification

## Purpose

Define build and verification requirements for languages used in Trustroots client code so incremental changes remain testable and visible to CI.
## Requirements
### Requirement: Client TypeScript support

The project SHALL compile client `.ts` and `.tsx` modules used by the current application and SHALL type-check those modules in CI without requiring existing JavaScript to pass TypeScript checking.

#### Scenario: JavaScript imports a converted client utility

- **WHEN** a JavaScript client module imports a converted TypeScript utility without a file extension
- **THEN** the development and production bundles resolve and compile the utility
- **AND** client tests can import and exercise it

#### Scenario: A client TypeScript file contains a type error

- **WHEN** the type-check command runs in CI
- **THEN** the command fails on that error

### Requirement: Client tooling retains TypeScript visibility

The project SHALL include client TypeScript and TSX in linting, test discovery, coverage collection and translation extraction where those tools apply.

#### Scenario: A translated client module is converted to TypeScript

- **WHEN** translation extraction runs
- **THEN** its translation keys are still extracted

#### Scenario: A covered client module is converted to TypeScript

- **WHEN** client coverage runs
- **THEN** that module remains in the coverage calculation

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

#### Scenario: JavaScript callers use explicit `.js` imports for migrated modules

- **WHEN** an existing JavaScript client module imports an administration, offer or search module with an explicit `.js` suffix
- **THEN** Jest and Webpack resolve the corresponding TypeScript or TSX source
- **AND** no JavaScript compatibility shim is required
