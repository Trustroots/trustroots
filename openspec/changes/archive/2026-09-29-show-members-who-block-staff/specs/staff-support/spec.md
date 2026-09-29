## ADDED Requirements

### Requirement: Staff can see members who blocked their account

The system SHALL allow administrators and Welcome team members to view the members who have blocked their signed-in account. The view SHALL expose only each member's public identifier, username, and display name.

#### Scenario: Authorised staff views members who blocked them

- **WHEN** an administrator or Welcome team member opens the support view
- **THEN** the system lists members whose block list contains that staff member

#### Scenario: Unauthorised member requests the list

- **WHEN** a member without the administrator or Welcome team role requests the list
- **THEN** the system denies access
