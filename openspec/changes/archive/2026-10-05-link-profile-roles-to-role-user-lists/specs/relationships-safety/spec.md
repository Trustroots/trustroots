## ADDED Requirements

### Requirement: Contact list ordering

The system SHALL offer date-added and name ordering on contact lists. Date ordering SHALL show newest contacts first and place missing dates after dated contacts. Name ordering SHALL be alphabetical without case sensitivity, falling back to username when a display name is unavailable. Pending and confirmed relationships SHALL retain their separate groups, and filtering SHALL continue to apply.

#### Scenario: Member changes contact ordering

- **WHEN** a member selects name ordering on a contacts view
- **THEN** each relationship group is displayed alphabetically by name
- **AND** the underlying relationship records remain unchanged

#### Scenario: Member opens a contact list

- **WHEN** a member opens a contact list
- **THEN** contacts in each relationship group are displayed newest first
