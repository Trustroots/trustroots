## ADDED Requirements

### Requirement: Experience change administration

The system SHALL let administrators find Experiences, issue member-scoped
change links, and review pending change requests. These capabilities SHALL be
unavailable to non-administrators.

#### Scenario: Administrator issues a link

- **WHEN** an administrator selects an Experience and its author or recipient
- **THEN** the system returns a seven-day link scoped to that Experience and member

#### Scenario: Administrator decides a request

- **WHEN** an administrator approves or rejects a pending Experience change request
- **THEN** the decision and administrator are recorded for audit

#### Scenario: Regular member requests an admin action

- **WHEN** a regular member requests link issuance or a review decision
- **THEN** the system denies access
