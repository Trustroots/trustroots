## ADDED Requirements

### Requirement: Reminder for a pending Experience reply

The system SHALL queue at most one reply reminder per Experience from day 11
until the ordinary automatic publication deadline.

#### Scenario: A pending Experience has an eligible recipient

- **WHEN** the Experience is at least 11 days old and is still in the reply window
- **THEN** the worker schedules a reply reminder for its recipient
- **AND** the email links to the sharing form without including pending feedback

#### Scenario: A queued reminder is no longer applicable

- **WHEN** the Experience is public, removed, expired or already has a reciprocal Experience at delivery
- **THEN** the worker skips the email
- **AND** it also skips unavailable or restricted members and blocked pairs
