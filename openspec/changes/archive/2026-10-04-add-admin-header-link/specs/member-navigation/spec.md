## ADDED Requirements

### Requirement: Administrator header shortcut

The desktop primary navigation SHALL show an Admin link to `/admin` immediately
before Circles when the signed-in member has the admin role. Other members,
including welcome-team members, SHALL not see the link.

#### Scenario: Administrator opens the header

- **WHEN** a signed-in administrator views the desktop header
- **THEN** Admin appears immediately before Circles and links to `/admin`

#### Scenario: Member without admin rights

- **WHEN** a signed-in member without the admin role views the header
- **THEN** no Admin shortcut is displayed
