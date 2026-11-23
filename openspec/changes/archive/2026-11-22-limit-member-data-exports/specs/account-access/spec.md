## ADDED Requirements

### Requirement: Member data export allowance

The system SHALL allow five data export requests per member per hour by default. The allowance SHALL be shared across sessions and client addresses for the same member.

#### Scenario: Member reaches the export allowance

- **WHEN** an authenticated member requests an export after using their hourly allowance
- **THEN** the system returns HTTP 429 with a `Retry-After` header before assembling the export
- **AND** another member on the same network can still use their own allowance
