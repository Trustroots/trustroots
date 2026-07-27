## MODIFIED Requirements

### Requirement: Contact relationships

The system SHALL let available members create, confirm, view, and remove
contact relationships. Suspended and shadowbanned members cannot create or
receive contact requests.

#### Scenario: Member creates and confirms a contact relationship

- **WHEN** a member sends a contact request and the other member confirms it
- **THEN** the system lists the members as confirmed contacts

#### Scenario: Contact request involves a restricted member

- **WHEN** a suspended or shadowbanned member attempts to send a contact
  request, or another member attempts to contact one
- **THEN** the system rejects the request
- **AND** the system does not create a contact record

#### Scenario: Member creates a duplicate contact request

- **WHEN** a member requests contact with someone already pending or confirmed
- **THEN** the system explains the existing relationship state

#### Scenario: Member removes a contact

- **WHEN** a member removes a confirmed contact
- **THEN** the system updates the members' contact lists
