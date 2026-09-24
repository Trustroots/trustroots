## ADDED Requirements

### Requirement: Incremental server ESM services preserve CommonJS consumers

Each server service migrated to ESM SHALL retain its current CommonJS import
path as an adapter until all consumers have migrated.

#### Scenario: CommonJS server code imports the JSON bootstrap service

- **WHEN** a CommonJS consumer requires the existing service path
- **THEN** it receives the same callable serialisation function and output
  contract

#### Scenario: ESM server code imports the JSON bootstrap service

- **WHEN** an ESM consumer imports the implementation
- **THEN** it can access the serialisation function through a named ESM export
