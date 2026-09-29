## ADDED Requirements

### Requirement: Member interactions server ESM preserves registration and consumers

Server implementations in messages, contacts, experiences, offers, references-thread, tribes SHALL use native ESM while retaining existing synchronous CommonJS entry paths, export shapes and registration behaviour during incremental migration.

#### Scenario: Existing bootstrap loads migrated modules

- **WHEN** existing application bootstrap discovers and loads models, configuration, policies, routes or jobs in these domains
- **THEN** registration occurs exactly once in the existing order with unchanged names and callable signatures

#### Scenario: Existing consumers invoke migrated handlers

- **WHEN** controllers, services or tests load these domains through existing CommonJS paths
- **THEN** handlers retain their behaviour, function context and shared mutable replacement semantics

#### Scenario: Migration regression checks run

- **WHEN** the migrated domains are validated
- **THEN** named exports are available for applicable ESM functions, coverage remains at the existing 100% baselines and existing end-to-end scenarios are retained
