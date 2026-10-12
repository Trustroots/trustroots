## ADDED Requirements

### Requirement: Bounded email confirmation lifetime

The system SHALL issue email confirmation credentials with a 24-hour lifetime and SHALL store only their digests once digest-token support is available. Legacy credentials lacking expiry metadata SHALL be accepted only within a configured, deployment-wide seven-day transition window.

#### Scenario: Link reaches its expiry boundary

- **WHEN** an email confirmation is submitted at or after its stored expiry
- **THEN** the system rejects it and leaves the account and pending email unchanged

#### Scenario: Member requests a replacement

- **WHEN** a resend or eligible reminder issues a new confirmation
- **THEN** the new link receives a fresh 24-hour lifetime
- **AND** earlier links cannot confirm the pending address

### Requirement: Atomic confirmation consumption

The system SHALL consume the current email confirmation and apply its account changes in one atomic operation matching the pending email and expiry. Read-only link validation SHALL never consume a credential.

#### Scenario: Two requests confirm concurrently

- **WHEN** two requests submit the same current confirmation credential
- **THEN** exactly one request applies the account changes
- **AND** the other receives the invalid-link outcome

#### Scenario: Reminder overlaps confirmation

- **WHEN** a reminder races with consumption or pending-address replacement
- **THEN** it cannot restore the consumed credential or overwrite the newer pending change

