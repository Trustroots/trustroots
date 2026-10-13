## ADDED Requirements

### Requirement: Support team access

The `support-team` role SHALL grant current greeter tools, allowlisted member search and details including restricted profiles and account status, and internal member notes. Only administrators SHALL grant or remove this role. It SHALL NOT confer moderation actions, exports, audit browsing or unrestricted private-conversation access.

#### Scenario: Support volunteer investigates an account

- **WHEN** a support volunteer searches for a suspended member
- **THEN** safe account details and status are available without authentication tokens or IP history
- **AND** suspension, shadowban and role changes remain denied

### Requirement: Support request inbox

Administrators and support volunteers SHALL view all stored support requests, filter them by category and open/resolved status, and resolve or reopen requests. Missing status SHALL mean open. Replies SHALL remain in the existing support email system.

#### Scenario: Support volunteer resolves a request

- **WHEN** a support volunteer resolves an open request
- **THEN** its status and acting staff member are recorded
- **AND** the request can subsequently be reopened

### Requirement: Report-scoped private investigation

Authenticated member reports SHALL store server-verified immutable reporter and target IDs. A linked report SHALL grant administrators and support volunteers audited, read-only access to the entire conversation and all experiences in both directions between the pair, including hidden messages and unpublished feedback. Access SHALL remain after resolution. Report forms SHALL explain this access before submission. Signed-out or ambiguous reports SHALL NOT unlock private content. Historical identities SHALL only be linked using reliable evidence, never current username ownership alone.

#### Scenario: Support volunteer reads a reported conversation

- **WHEN** a support volunteer opens a reliably linked member report
- **THEN** the entire pair's conversation and experiences are available through pagination
- **AND** unrelated pairs cannot be selected
- **AND** reading does not mark messages read or publish experiences

#### Scenario: Report has no verified pair

- **WHEN** support opens a signed-out or historically ambiguous report
- **THEN** the report text remains available but private investigation is denied
