## ADDED Requirements

### Requirement: Staff can see members who blocked staff accounts

The system SHALL allow administrators to view members who blocked any administrator or Welcome team member, and Welcome team members to view those who blocked their own account. The view SHALL expose only public identifiers, usernames, and display names.

#### Scenario: Authorised staff views members who blocked them

- **WHEN** an administrator or Welcome team member opens the support view
- **THEN** the system lists members whose block list contains the staff member or, for administrators, any administrator or Welcome team member

#### Scenario: Unauthorised member requests the list

- **WHEN** a member without the administrator or Welcome team role requests the list
- **THEN** the system denies access
