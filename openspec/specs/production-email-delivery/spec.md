# production-email-delivery Specification

## Purpose

Keep queued application email delivery reliable and provide tools to diagnose interruptions.

## Requirements

### Requirement: Queued email retries

The worker SHALL retry temporary SMTP failures with bounded exponential backoff and jitter and record sanitised outcomes for mail attempts.

#### Scenario: Temporary SMTP failure

- **WHEN** the provider returns a temporary SMTP failure
- **THEN** the pending retry survives a worker restart

#### Scenario: Permanent rejection

- **WHEN** the provider permanently rejects the recipient
- **THEN** the worker records a terminal failure

### Requirement: Independent mail checks

Operations SHALL be able to check queue health, worker-side SMTP connectivity and receipt at a dedicated inbox.

#### Scenario: Provider outage after deployment

- **WHEN** the deployed worker cannot verify SMTP
- **THEN** the deployment reports the mail check failure without rolling back the webapp

#### Scenario: Canary receipt

- **WHEN** a scheduled or post-deployment canary is permitted by the shared rate limit
- **THEN** it is queued through the normal email worker and the check reports whether the dedicated inbox received it before the deadline

### Requirement: Administrator email queue overview

The system SHALL provide an administrator-only overview at `/admin/email` showing aggregate queue and worker health from the operational mail queue checks. SparkPost diagnostics and the read-only reply mailbox at `/admin/email/replies` SHALL be accessible from the overview. The previous reply mailbox URL SHALL redirect to the new URL. The queue health endpoint SHALL be read-only and return no message payloads or recipients.

#### Scenario: Administrator investigates a delayed queue

- **WHEN** an administrator opens the email overview
- **THEN** they see the configured mail mode, worker heartbeat state, queued and retrying counts, oldest due job age, stalled attempts, and recent failure and processing metrics
- **AND** they can open the SparkPost delivery and recovery dashboard or check the reply mailbox

#### Scenario: Member requests email queue diagnostics

- **WHEN** a non-administrator requests the overview or queue diagnostics
- **THEN** access is denied
