## ADDED Requirements

### Requirement: Embedded public profile on member reports

The system SHALL display the reported member's public profile beneath the
moderation information on a username-addressed admin member report. The profile
view SHALL use the existing member profile data and visibility rules, with the
authenticated administrator as the viewer and the reported member as the
profile subject. The existing member heading and moderation actions SHALL
remain in their current report layout.

#### Scenario: Administrator reviews a member profile from the report

- **WHEN** an administrator opens `/admin/user/<username>` for an existing
  member
- **THEN** the member's public profile is displayed below the moderation
  information
- **AND** the profile request uses the administrator's session and the
  reported username
- **AND** the member heading, moderation actions, and greeter role labels
  remain in the report header

#### Scenario: Profile is unavailable to the administrator

- **WHEN** the existing profile access rules do not provide a profile for the
  reported member
- **THEN** the admin report remains available and no unsanitised profile data
  is shown

### Requirement: Accessible role-change confirmation

The system SHALL confirm role changes in an application dialog that identifies
the member and requested action. The dialog SHALL provide explicit cancel and
confirm controls, keyboard dismissal while idle, focus management, progress
feedback while the change is submitted, and an accessible error when the
request fails. Cancelling SHALL leave the member roles unchanged.

#### Scenario: Administrator confirms a role change

- **WHEN** an administrator confirms a role change in the dialog
- **THEN** the existing role-change API is called once for the selected member
  and role
- **AND** the member report refreshes after success

#### Scenario: Administrator cancels a role change

- **WHEN** an administrator cancels or dismisses the role-change dialog before
  submission
- **THEN** the role-change API is not called

#### Scenario: Role-change request fails

- **WHEN** the role-change API returns an error
- **THEN** the dialog explains that the role could not be changed
- **AND** the administrator can retry or cancel the action
