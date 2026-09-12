## ADDED Requirements

### Requirement: Flagged signup alerts

The system SHALL send a best-effort internal alert after a newly created
account's identifying signup text matches a configured safety-review keyword.

#### Scenario: Signup matches a keyword

- **WHEN** a saved signup's first name, last name, display name, or username
  contains a configured keyword case-insensitively
- **THEN** the system sends an internal alert identifying the matched keywords
  and member

#### Scenario: Alert delivery fails

- **WHEN** delivery of a flagged-signup alert fails
- **THEN** the saved account's confirmation and login flow continues normally
