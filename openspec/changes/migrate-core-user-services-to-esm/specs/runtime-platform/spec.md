## ADDED Requirements

### Requirement: Incremental server ESM services preserve CommonJS consumers

Each server service migrated to ESM SHALL retain its current CommonJS import
path as an adapter until all consumers have migrated.

#### Scenario: CommonJS server code imports a migrated service

- **WHEN** a CommonJS consumer requires an existing core or user service path
- **THEN** it receives the same callable or object export shape and behaviour

#### Scenario: ESM server code imports a migrated service

- **WHEN** an ESM consumer imports the implementation
- **THEN** it can access the service functions through named ESM exports
