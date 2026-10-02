## MODIFIED Requirements

### Requirement: Account settings

The system SHALL let an authenticated account holder update valid account
details and change their password after providing their current password. The
account settings page SHALL explain the existing username format, availability,
and change timing rules beside the username field.

#### Scenario: Account holder updates account details

- **WHEN** an authenticated account holder submits valid account details
- **THEN** the system saves the updated details

#### Scenario: Account holder changes their password

- **WHEN** an authenticated account holder provides their current password and matching valid new passwords
- **THEN** the system updates their password
- **AND** the account holder can sign in with the new password

#### Scenario: Account holder reads username change rules

- **WHEN** an authenticated account holder opens account settings
- **THEN** the username field explains when changes are allowed and what makes
  a username valid and available
