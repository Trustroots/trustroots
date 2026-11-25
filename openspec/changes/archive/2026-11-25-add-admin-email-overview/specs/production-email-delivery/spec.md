## ADDED Requirements

### Requirement: Administrator email queue overview

The system SHALL provide an administrator-only overview at `/admin/email` showing aggregate queue and worker health from the operational mail queue checks. SparkPost diagnostics and the read-only reply mailbox at `/admin/email/replies` SHALL be accessible from the overview. The previous reply mailbox URL SHALL redirect to the new URL. The queue health endpoint SHALL be read-only and return no message payloads or recipients.

#### Scenario: Administrator investigates a delayed queue

- **WHEN** an administrator opens the email overview
- **THEN** they see the configured mail mode, worker heartbeat state, queued and retrying counts, oldest due job age, stalled attempts, and recent failure and processing metrics
- **AND** they can open the SparkPost delivery and recovery dashboard or check the reply mailbox

#### Scenario: Member requests email queue diagnostics

- **WHEN** a non-administrator requests the overview or queue diagnostics
- **THEN** access is denied
