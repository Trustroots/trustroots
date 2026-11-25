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

### Requirement: Queue production deployment emails

The deployment helper SHALL hand successful deploy and explicit rollback
receipts to the existing email queue. Queueing and SMTP delivery SHALL require an
explicit production tier, production runtime, canonical domain and live mail.

#### Scenario: A checked production deployment or explicit rollback succeeds

- **WHEN** readiness succeeds and the receipt is durably completed
- **THEN** the handoff snapshots eligible destinations using the recipient
  preview rule and queues one email per destination
- **AND** each email includes the deployed commit link, readiness time and
  effective mail mode
- **AND** a same-version redeploy or explicit rollback has its own notification identity

#### Scenario: An attempt cannot announce success

- **WHEN** the receipt is pending or failed or a production mail gate fails
- **THEN** no deployment email is queued
- **AND** startup and ordinary restarts do not initiate handoff

### Requirement: Recover deployment notification queueing

The system SHALL persist queueing progress per receipt and provide an explicit
recovery command. A handoff failure SHALL be visible without rolling back a
healthy deployment.

#### Scenario: Handoff is repeated, interrupted or concurrent

- **WHEN** one or more commands process the same receipt UUID
- **THEN** they reuse the original destination snapshot and stable Agenda job
  identity per destination
- **AND** completed recipients are skipped and an unacknowledged insertion
  can be retried without replacing the existing job

#### Scenario: The operator verifies rollout

- **WHEN** the handoff reports queueing complete
- **THEN** the operator can distinguish queueing from SMTP acceptance and inbox
  delivery using the documented checks
- **AND** the documentation explains the duplicate-delivery risk of ambiguous SMTP acceptance
