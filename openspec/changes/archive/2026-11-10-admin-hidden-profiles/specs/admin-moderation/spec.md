## ADDED Requirements

### Requirement: Administrators can inspect hidden member profiles

The admin member report SHALL display a profile preview even when the profile is hidden from other members. The report SHALL explain whether an unconfirmed signup, suspension or shadowban applies, and indicate when the reason for a non-public profile is unknown.

#### Scenario: Administrator opens an unconfirmed member by username

- **WHEN** an administrator opens the member report for a member whose signup email is unconfirmed
- **THEN** the report shows the member's profile preview and identifies the unconfirmed signup as a visibility restriction

#### Scenario: Another member opens a non-public profile

- **WHEN** a regular member requests another member's non-public profile
- **THEN** the request is denied
