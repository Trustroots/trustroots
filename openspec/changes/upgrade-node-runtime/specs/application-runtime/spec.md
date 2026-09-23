## ADDED Requirements

### Requirement: Supported application runtime

The application SHALL use Node.js 24 and npm 11 consistently in development,
continuous integration and production while preserving the existing hybrid
Angular and React frontend and background job behaviour.

#### Scenario: Developer installs dependencies

- **WHEN** a developer performs a clean installation with the supported runtime
- **THEN** the committed npm lockfile produces a reproducible dependency tree
- **AND** both existing frontend bundles can be built

#### Scenario: Application and worker are deployed

- **WHEN** the production image runs the application and background worker
- **THEN** both processes use Node.js 24
- **AND** existing routes, uploads and scheduled jobs retain their behaviour
- **AND** no database migration is required
