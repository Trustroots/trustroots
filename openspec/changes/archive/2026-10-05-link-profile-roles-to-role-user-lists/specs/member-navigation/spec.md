## MODIFIED Requirements

### Requirement: Administrator header shortcut

The desktop primary navigation SHALL show an Admin link immediately before
Circles when the signed-in member has the admin or `welcome-team` role. A
welcome-team member's link SHALL go directly to `/admin/acquisition-stories`;
other administrators' link SHALL go to `/admin`.

#### Scenario: Administrator opens the header

- **WHEN** a signed-in administrator without the welcome-team role views the desktop header
- **THEN** Admin appears immediately before Circles and links to `/admin`

#### Scenario: Welcome team member opens the header

- **WHEN** a signed-in welcome-team member views the desktop header
- **THEN** Admin appears immediately before Circles and links to `/admin/acquisition-stories`

#### Scenario: Member without staff access

- **WHEN** a signed-in member without the admin or welcome-team role views the header
- **THEN** no Admin shortcut is displayed
