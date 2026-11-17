## ADDED Requirements

### Requirement: Pages server code uses native ESM

The pages controllers and routes SHALL use ordinary ESM exports without a `module.exports` export. Their server tests SHALL load them through ESM imports, and lint SHALL reject a `module.exports` export in modules whose CommonJS consumers have migrated.

#### Scenario: The server registers pages routes

- **WHEN** Express loads the pages route file
- **THEN** it calls the default export, which registers the volunteers and greeters routes with the controllers' existing behaviour

#### Scenario: Server tests exercise the pages module

- **WHEN** the pages controller and route suites run
- **THEN** they are `.mts` files that import the controllers, models and test utilities through ESM

#### Scenario: A compatibility export returns

- **WHEN** a pages server file or the text service adds an `export { … as 'module.exports' }`
- **THEN** lint fails
