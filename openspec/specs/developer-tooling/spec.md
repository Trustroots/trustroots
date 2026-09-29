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

### Requirement: Core, messaging and support client modules use strict TypeScript

All production modules under `modules/core/client`, `modules/messages/client` and `modules/support/client` SHALL use `.ts` or `.tsx` with meaningful strict types, while preserving their runtime behaviour, translations, module exports and import compatibility.

#### Scenario: Existing JavaScript callers import migrated platform modules

- **WHEN** a JavaScript caller imports a migrated core, messaging or support module without an extension
- **THEN** the development and production bundles resolve and compile that module
- **AND** client tests can import and exercise it

#### Scenario: Type-checking migrated platform modules

- **WHEN** the client TypeScript check runs
- **THEN** it checks the migrated core, messaging and support modules under strict TypeScript settings
- **AND** the migration does not rely on broad `any` types or TypeScript/lint suppressions

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
