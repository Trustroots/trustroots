## ADDED Requirements

### Requirement: Support team dashboard activity

The system SHALL grant members with the `support-team` role read access to the recent activity panes at `/admin` and their dashboard API. Support navigation SHALL link to the dashboard. The dashboard SHALL reserve search, circle management, reference thread history and message inspection links for administrators.

#### Scenario: Support team member opens the dashboard

- **WHEN** a support team member opens the dashboard from support navigation
- **THEN** the dashboard shows the ten most active messengers from the previous seven days
- **AND** it shows the ten most recent negative thread votes and the ten most recent negative experiences
- **AND** member links open support member views
- **AND** administrator-only tools are omitted

#### Scenario: Member without a dashboard role requests access

- **WHEN** a member with neither the `admin` nor `support-team` role requests the dashboard page or API
- **THEN** the system denies access
