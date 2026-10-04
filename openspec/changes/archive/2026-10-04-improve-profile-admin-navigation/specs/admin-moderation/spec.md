## ADDED Requirements

### Requirement: Profile admin navigation

Public profile action links SHALL be consistently aligned. Administrators SHALL
see an Admin action linking to `/admin/user?id=<viewed-member-id>`, on desktop
and mobile. Other members, including the welcome team, SHALL not see it.

#### Scenario: Administrator views a member

- **WHEN** an administrator opens a member's profile
- **THEN** the Admin action opens that member's existing admin record

#### Scenario: Non-administrator views a member

- **WHEN** a non-administrator opens a profile
- **THEN** no Admin action is displayed

### Requirement: Admin member username URLs

The application SHALL support `/admin/user/:username` with the same admin-only
access as `/admin/user`. It SHALL run the existing member lookup for that
username, while preserving ID, IP and query URL support.

#### Scenario: Username deep link

- **WHEN** an administrator opens `/admin/user/fictional-member`
- **THEN** the admin page looks up fictional-member and shows its member record
