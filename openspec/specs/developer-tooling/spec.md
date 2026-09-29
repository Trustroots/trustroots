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

### Requirement: Member-facing client modules use strict TypeScript
The users, contacts, tribes, experiences and references-thread client modules SHALL use `.ts` or `.tsx` for all migrated production modules, with meaningful types that pass the project TypeScript checks without suppressing diagnostics.

#### Scenario: Migrated member modules are type-checked
- **WHEN** the project TypeScript check runs
- **THEN** every migrated production module is included in the check and passes without blanket `any` types or TypeScript suppression comments

#### Scenario: Existing member-facing imports remain compatible
- **WHEN** existing client modules import a migrated module using its prior extensionless or explicit `.js` path
- **THEN** client bundling and tests resolve the converted module with the same runtime behaviour

#### Scenario: Member-facing client coverage stays complete
- **WHEN** client tests and full client coverage run after migration
- **THEN** migrated functionality remains covered and the client coverage requirement stays at 100 percent

### Requirement: Public pages and statistics client code use TypeScript

The project SHALL implement the public pages and statistics client modules in strict TypeScript while preserving their existing runtime behaviour and client test coverage.

#### Scenario: A public page or statistics module is type-checked

- **WHEN** the client TypeScript type-check runs
- **THEN** public pages and statistics client modules are included in the strict check
- **AND** those modules contain no unchecked JavaScript implementations

#### Scenario: Public pages or statistics code is covered by client tests

- **WHEN** the client test suite and coverage run
- **THEN** the migrated modules remain exercised by their existing tests
- **AND** the established client coverage thresholds remain satisfied
