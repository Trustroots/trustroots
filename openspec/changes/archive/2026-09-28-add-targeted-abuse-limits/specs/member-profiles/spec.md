## ADDED Requirements

### Requirement: Targeted avatar-upload limits

The system SHALL enforce a configurable, shared request limit for authenticated avatar uploads using the account identity and a bounded window.

#### Scenario: Member exceeds the avatar-upload policy

- **WHEN** a member exceeds the configured avatar-upload limit within its window
- **THEN** the request is rejected with HTTP 429 and a `Retry-After` header
