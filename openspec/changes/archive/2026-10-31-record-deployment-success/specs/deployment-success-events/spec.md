## ADDED Requirements

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
