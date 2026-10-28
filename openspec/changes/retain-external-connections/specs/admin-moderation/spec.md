## ADDED Requirements

### Requirement: Staff external connection investigation

Administrators and support-team members SHALL view current and historical external connections on member detail pages and search across members by network and complete current or previous identifier. Recognised profile URLs SHALL be accepted as search input. Results SHALL be paginated in stable pages of 50 and links SHALL use recognised network domains. Reads SHALL follow staff audit conventions.

The same access and search controls SHALL apply to current and previous email addresses.

#### Scenario: Staff inspect a member

- **WHEN** an administrator or support-team member opens connection history
- **THEN** current links and newest-first dated changes are available
- **AND** initial snapshots show the original date as unknown

#### Scenario: Staff search a removed identifier

- **WHEN** staff search the network and a complete removed identifier or recognised URL
- **THEN** matching accounts appear once with a current or previous label and member link

#### Scenario: Unauthorised access

- **WHEN** a guest, ordinary member or welcome-only member requests history or search
- **THEN** access is denied
