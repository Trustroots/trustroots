## ADDED Requirements

### Requirement: Server-owned relationship fields

Contact and thread-reference creation SHALL construct records from supported operation fields. Record identifiers, authenticated authors and creation timestamps SHALL be assigned by the server. Existing relationship authorisation and confirmation rules SHALL remain in force.

#### Scenario: A member supplies additional record fields

- **WHEN** a contact or thread-reference request includes identifiers, timestamps or author fields
- **THEN** the persisted record uses server-assigned values
- **AND** the existing creation and confirmation flow remains available
