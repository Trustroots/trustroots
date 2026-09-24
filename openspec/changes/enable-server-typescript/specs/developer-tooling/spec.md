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
