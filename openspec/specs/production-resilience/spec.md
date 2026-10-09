# production-resilience Specification

## Purpose

Keep member actions and deployments available during telemetry outages, require production storage and secure session configuration, and verify deployments with an explicit rollback path.

## Requirements

### Requirement: Optional statistics delivery

The system SHALL complete locally valid application statistics calls without waiting for a remote statistics service. Delivery SHALL have bounded request duration and concurrency. Delivery-aware background jobs SHALL retain delivery error reporting.

#### Scenario: Statistics service is unavailable

- **WHEN** a member signs in while the statistics service is unavailable
- **THEN** authentication and session persistence complete independently of statistics delivery

### Requirement: Deployment prerequisites and verification

The deployment command SHALL refuse deployment when required media storage is unmounted, remote logging is configured, production session configuration is invalid, or the database cannot be reached. It SHALL verify readiness and a login/session round trip before reporting success.

#### Scenario: Media storage is missing

- **WHEN** the configured media mount is absent
- **THEN** deployment stops before pulling or replacing containers

### Requirement: Immutable rollback

The deployment command SHALL save the previous app and worker image IDs before replacing containers and SHALL restore those IDs when verification fails. Explicit rollback SHALL not pull mutable tags.

#### Scenario: New application fails verification

- **WHEN** readiness or session verification fails after replacement
- **THEN** the command attempts restoration of the previous app and worker images and exits with failure

### Requirement: Optional browser analytics

The system SHALL load browser analytics without delaying document readiness or authentication and SHALL allow operators to disable analytics independently of application scripts.

#### Scenario: Analytics host stalls

- **WHEN** the Umami script fails or remains unavailable
- **THEN** the member can sign in and retain a session without waiting for analytics

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
