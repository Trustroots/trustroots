## ADDED Requirements

### Requirement: Bounded signup requests

Signup SHALL accept only supported registration fields. The server SHALL apply
shared request limits by client address and normalised recipient email before
account creation and email delivery, returning HTTP 429 and Retry-After when a
policy is exceeded.

#### Scenario: Signup recipient reaches its limit

- **WHEN** signup attempts for the same normalised email exceed the configured limit
- **THEN** further attempts are rejected even from another client address
- **AND** no account or email job is created for the rejected request

#### Scenario: Caller supplies account state

- **WHEN** signup contains fields outside the supported registration fields
- **THEN** those fields do not alter server-owned account state
