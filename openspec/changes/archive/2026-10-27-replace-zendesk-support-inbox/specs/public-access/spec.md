## ADDED Requirements

### Requirement: Durable support submission acknowledgement

When the shared support inbox is enabled, a support submission SHALL be durably stored before a threaded acknowledgement is queued to its valid requester email. It SHALL NOT also forward the same submission into the monitored support mailbox. Existing submission/category validation and report identity verification SHALL remain enforced.

#### Scenario: Request storage fails

- **WHEN** a support submission cannot be stored
- **THEN** the user receives an error and no acknowledgement or external support forwarding is sent.

#### Scenario: Shared inbox is disabled

- **WHEN** the feature is not enabled
- **THEN** the existing support delivery flow remains available and mailbox intake does not run.
