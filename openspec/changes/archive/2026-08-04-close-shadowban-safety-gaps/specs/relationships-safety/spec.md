## MODIFIED Requirements

### Requirement: Contact-list visibility

The system SHALL show a member's available contacts and relevant common
contacts where relationship visibility permits. Suspended and shadowbanned
accounts SHALL be omitted from user-facing contact lists even when an existing
contact record remains.

#### Scenario: Member views contacts

- **WHEN** a member opens an available contacts view
- **THEN** the system displays the visible contacts or an empty state
- **AND** omits suspended and shadowbanned contacts

#### Scenario: Member requests common contacts

- **WHEN** a member requests common contacts for two members
- **THEN** the system returns the contacts shared by both members where permitted
- **AND** omits suspended and shadowbanned contacts
