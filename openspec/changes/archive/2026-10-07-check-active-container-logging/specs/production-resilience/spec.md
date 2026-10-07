## ADDED Requirements

### Requirement: Existing container logging prerequisites

The deployment command SHALL check desired Compose logging and all existing
webapp, worker and database containers before pulling or replacing images.
Logging SHALL use the local driver with explicit positive file-size and file-count
limits. Inspection SHALL have bounded duration and fail closed. Remote log
shipping SHALL remain independent of application and database container lifecycle.

#### Scenario: Compose changed but containers still use remote logging

- **WHEN** Compose specifies local logging but an existing container uses a remote driver
- **THEN** preflight stops before pulling or replacing containers
- **AND** the operator is directed to migrate logging separately

#### Scenario: Local logging has invalid rotation limits

- **WHEN** desired configuration or an existing container lacks positive rotation limits
- **THEN** deployment stops before pulling or replacing containers

#### Scenario: Docker inspection stalls

- **WHEN** existing container logging cannot be inspected within the timeout
- **THEN** deployment stops without attempting container replacement
