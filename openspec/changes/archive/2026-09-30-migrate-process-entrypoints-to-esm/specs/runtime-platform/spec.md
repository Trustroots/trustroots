## ADDED Requirements

### Requirement: Production process entry implementations use native ESM

The server and background worker startup implementations SHALL use native ESM while retaining their existing synchronous `.js` launch paths.

#### Scenario: Existing server command starts the application

- **WHEN** deployment or local scripts run `node server.js`
- **THEN** the native ESM implementation starts the application through the existing app initialisation service

#### Scenario: Existing worker command starts background jobs

- **WHEN** deployment or local scripts run `node worker.js`
- **THEN** database connection, model loading, job unlock and worker start run in order with unchanged error handling
