## ADDED Requirements

### Requirement: Authenticated password-change allowance

The system SHALL allow ten authenticated password-change requests per member per fifteen-minute window by default. The browser and mobile APIs SHALL share this allowance across sessions for the same member.

#### Scenario: Member reaches the shared password-change allowance

- **WHEN** a member requests a password change after exhausting their allowance across either client
- **THEN** the system returns HTTP 429 with a `Retry-After` header before checking the current password or writing credentials
- **AND** the existing password remains valid
