## ADDED Requirements

### Requirement: Server TypeScript has a separate strict checker

The project SHALL lint and type-check opted-in server TypeScript with
Node-aware resolution without changing the CommonJS runtime contract of
existing server JavaScript.

#### Scenario: Server type checking runs

- **WHEN** the server type-check command runs
- **THEN** it checks only the explicitly included server TypeScript files and
  declarations
- **AND** it does not require the existing JavaScript server tree to pass
  TypeScript checking

#### Scenario: Server TypeScript is linted

- **WHEN** repository lint runs
- **THEN** opted-in server TypeScript uses the TypeScript parser and Node
  environment
- **AND** lint settings for existing JavaScript remain unchanged

#### Scenario: TypeScript server code imports a declared CommonJS service

- **WHEN** a checked server TypeScript module imports the JSON-for-script
  service
- **THEN** the type checker exposes its callable input and output types
- **AND** the production JavaScript service remains the runtime implementation

### Requirement: Server TypeScript can run on the supported Node runtime

Opted-in server `.cts` modules SHALL use syntax that Node 24 can strip and
execute without a separate transpilation step. Existing CommonJS service
paths SHALL remain callable by current consumers.

#### Scenario: Authentication service uses a typed implementation

- **WHEN** the existing authentication service path is required by server code
- **THEN** it loads the typed implementation through the CommonJS adapter
- **AND** username validation and email-token outputs remain unchanged

#### Scenario: Build metadata uses typed formatting

- **WHEN** the existing build-metadata helper is required
- **THEN** it uses a typed implementation for branch and timestamp formatting
- **AND** its existing callback and export shapes remain unchanged

#### Scenario: Runtime TypeScript is checked before deployment

- **WHEN** the server type-check command runs
- **THEN** it checks both runtime `.cts` implementations under strict settings
- **AND** runtime execution does not depend on TypeScript compiler output
