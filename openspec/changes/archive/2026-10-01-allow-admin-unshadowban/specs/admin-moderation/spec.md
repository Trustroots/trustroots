## MODIFIED Requirements

### Requirement: Role changes and audit history

The system SHALL let authorised administrators apply permitted moderation-role
changes, including removing a member's `shadowban` role, and review the
administration audit history. Removing the role SHALL leave messages already
hidden during the shadowban hidden.

#### Scenario: Administrator unshadowbans a member

- **WHEN** an authorised administrator confirms Unshadowban on a shadowbanned member report
- **THEN** the `shadowban` role is removed and the member report reflects the change
- **AND** the removal is recorded in moderation notes and the audit history
- **AND** previously hidden messages remain hidden

#### Scenario: Member attempts to remove a shadowban

- **WHEN** a member without the `admin` role requests removal of a shadowban
- **THEN** the system denies access

#### Scenario: Administrator changes a member's moderation role

- **WHEN** an authorised administrator applies a permitted role change
- **THEN** the member's role is updated
- **AND** the action is recorded in the audit history

#### Scenario: Administrator requests an impermissible role change

- **WHEN** an authorised administrator requests a role change that is not permitted
- **THEN** the system rejects the request
