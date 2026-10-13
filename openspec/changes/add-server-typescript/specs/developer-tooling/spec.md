## ADDED Requirements

### Requirement: Server TypeScript support

Server code MAY be written as strict TypeScript `.mts` modules that Node 24 executes directly, without a build step and without enabling `checkJs` across the existing JavaScript.

#### Scenario: Typed server modules are verified

- **WHEN** `npm run typecheck` and linting run
- **THEN** `.mts` server files are checked with strict NodeNext settings
- **AND** only erasable TypeScript syntax is accepted

#### Scenario: Typed server modules are loaded

- **WHEN** the server, worker or a test loads a `.mts` module through import or `require()`
- **THEN** discovery, watching and the module's default and `module.exports` exports behave as for `.mjs`

#### Scenario: Typed server modules are covered

- **WHEN** server coverage runs
- **THEN** `.mts` implementations are instrumented with source positions matching the TypeScript file
- **AND** they remain inside the existing 100 percent coverage gate
