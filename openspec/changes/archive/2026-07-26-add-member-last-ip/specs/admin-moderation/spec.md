## ADDED Requirements

### Requirement: Current IP address moderation context

The system SHALL retain only the current client IP address observed during a
member's authenticated activity. It SHALL make that address available only to
authorised administrators in member-search results and member reports.

#### Scenario: Member performs authenticated activity

- **WHEN** a member performs authenticated activity from a client IP address
- **THEN** the system records the member's current client IP address
- **AND** replaces any previously stored IP address for that member

#### Scenario: Administrator views a member

- **WHEN** an authorised administrator views a member in a search result or
  member report
- **THEN** the system displays the member's current stored IP address when one
  is available

#### Scenario: Administrator follows an IP address

- **WHEN** an authorised administrator selects a displayed IP address
- **THEN** the system displays members whose current stored IP address exactly
  matches that address

#### Scenario: Regular member requests an IP-address lookup

- **WHEN** a regular member requests the administrator IP-address lookup
- **THEN** the system denies access
