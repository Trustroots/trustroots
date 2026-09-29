## ADDED Requirements

### Requirement: Incremental server ESM interoperability

Server modules migrated to native ESM SHALL remain available to existing
CommonJS server consumers until those consumers are migrated.

#### Scenario: Existing consumer loads a migrated service

- **WHEN** a CommonJS server module loads a migrated service through its existing path
- **THEN** it receives the same callable exports and configuration values

#### Scenario: ESM consumer loads a migrated service

- **WHEN** an ESM server module imports the migrated service
- **THEN** it can use named exports without a CommonJS namespace adapter
