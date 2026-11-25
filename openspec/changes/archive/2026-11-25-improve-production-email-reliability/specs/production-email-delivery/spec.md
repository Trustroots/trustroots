## ADDED Requirements

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
