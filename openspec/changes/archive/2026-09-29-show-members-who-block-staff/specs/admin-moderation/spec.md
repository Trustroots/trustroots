## ADDED Requirements

### Requirement: Staff can identify members who blocked staff accounts

The system SHALL allow administrators to view members who blocked any administrator or Welcome team member, and Welcome team members to view those who blocked their own account. The view SHALL expose only public identifiers, usernames, and display names.

#### Scenario: Authorised staff views members who blocked them

- **WHEN** an administrator or Welcome team member opens the support view
- **THEN** the system lists members whose block list contains the staff member or, for administrators, any administrator or Welcome team member

#### Scenario: Unauthorised member requests the list

- **WHEN** a member without the administrator or Welcome team role requests the list
- **THEN** the system denies access

## MODIFIED Requirements

### Requirement: Administrator-only access

The system SHALL restrict administration tools and administration APIs to
authorised administrators, except that members with the `welcome-team` role
SHALL also have access to acquisition stories and analysis and their APIs, as
well as a staff support view where administrators can see who blocked any
administrator or Welcome team member and Welcome team members can see who
blocked their own account.

#### Scenario: Administrator opens the dashboard

- **WHEN** an authorised administrator opens the administration dashboard
- **THEN** the dashboard is displayed

#### Scenario: Regular member requests an administration API

- **WHEN** a regular member without an applicable administrative role requests an administration API
- **THEN** the system denies access

### Requirement: Welcome team acquisition access

The system SHALL allow members with the `welcome-team` role to view acquisition stories and analysis, including all existing acquisition data, and the blockers of their own account. Administrator permissions beyond these tools SHALL remain restricted to administrators. The interface SHALL display the role as Welcome team and show only accessible navigation and member links.

#### Scenario: Welcome team views acquisition pages

- **WHEN** a welcome-team member opens either acquisition page or calls its API
- **THEN** access is granted and existing data is returned
- **AND** unrelated administrator pages and APIs remain forbidden
