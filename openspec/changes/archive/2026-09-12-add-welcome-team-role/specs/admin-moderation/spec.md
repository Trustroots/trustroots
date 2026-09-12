## MODIFIED Requirements

### Requirement: Administrator-only access

The system SHALL restrict administration tools and administration APIs to
authorised administrators, except that members with the `welcome-team` role
SHALL also have access to acquisition stories and analysis and their APIs.

#### Scenario: Administrator opens the dashboard

- **WHEN** an authorised administrator opens the administration dashboard
- **THEN** the dashboard is displayed

#### Scenario: Regular member requests an administration API

- **WHEN** a regular member without an applicable administrative role requests an administration API
- **THEN** the system denies access

## ADDED Requirements

### Requirement: Welcome team acquisition access

The system SHALL allow members with the `welcome-team` role to view acquisition stories and analysis, including all existing acquisition data, without granting other administrator permissions. The interface SHALL display the role as Welcome team and show only accessible navigation and member links.

#### Scenario: Welcome team views acquisition pages

- **WHEN** a welcome-team member opens either acquisition page or calls its API
- **THEN** access is granted and existing data is returned
- **AND** unrelated administrator pages and APIs remain forbidden

### Requirement: Administrator manages Welcome team membership

Administrators SHALL be able to grant and revoke `welcome-team` from member role management. The role-change API SHALL accept an optional action of add or remove, default to add, and permit removal only for welcome-team. Changes SHALL preserve other roles and create administrator notes.

#### Scenario: Administrator grants and revokes membership

- **WHEN** an administrator grants or revokes Welcome team membership
- **THEN** the stored role and refreshed role inventory reflect the change
- **AND** subsequent acquisition API access reflects the current roles

#### Scenario: Member attempts to grant access

- **WHEN** a non-administrator requests a role change
- **THEN** the request is forbidden
