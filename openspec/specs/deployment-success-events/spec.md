# deployment-success-events Specification

## Purpose

Retain durable evidence of verified deployments and explicit rollbacks, with
stable event identities and operator recovery for interrupted receipt completion.

## Requirements

### Requirement: Durable readiness receipts

The deployment helper SHALL persist an event identity and intended immutable
images before replacement and mark success only after readiness verification.

#### Scenario: Deployment or explicit rollback succeeds

- **WHEN** both containers are replaced and readiness and login checks pass
- **THEN** the receipt records the build commit and readiness time separately
- **AND** a new invocation has a new event identity even for the same version

#### Scenario: Replacement or readiness fails

- **WHEN** an attempted deployment fails and previous images are restored
- **THEN** the attempted version has no successful receipt

### Requirement: Recoverable receipt completion

The helper SHALL allow completion of an existing pending event only after
matching its origin and intended images and repeating readiness checks.

#### Scenario: Operator resumes an interrupted event

- **WHEN** the same intended images are running and re-verification passes
- **THEN** recovery completes the saved event without creating another identity
- **AND** repeating recovery of a completed receipt leaves it unchanged

#### Scenario: Receipt persistence fails after readiness

- **WHEN** completion cannot be persisted
- **THEN** the helper reports the event identity for recovery
- **AND** it does not roll back a healthy deployment solely for that failure

### Requirement: Operators can preview deployment notification recipients

The system SHALL provide a read-only operator command that reports the number of
eligible deployment notification destinations. It SHALL require an explicit
production tier, production runtime, canonical production domain and effective
live mail mode before querying user records.

#### Scenario: Preview the production audience

- **WHEN** all production gates pass
- **THEN** the preview counts unique current email destinations for public
  accounts with the greeter or admin role, excluding suspended accounts and
  invalid addresses
- **AND** it deduplicates trimmed, lowercased addresses
- **AND** it reveals only the count and creates no mail jobs

#### Scenario: Reject an ineligible runtime

- **WHEN** a production gate fails
- **THEN** the preview exits unsuccessfully before querying users
