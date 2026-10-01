## ADDED Requirements

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
