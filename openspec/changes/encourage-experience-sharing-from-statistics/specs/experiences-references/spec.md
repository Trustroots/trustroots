## ADDED Requirements

### Requirement: Experience suggestion

The system SHALL let a signed-in public member request one random confirmed,
public contact for whom that member has not shared an experience. The system
SHALL exclude pending, private, shadow-hidden, suspended, blocked, and already-reviewed
contacts, and SHALL return no contact when none is eligible.

#### Scenario: Member has an eligible contact

- **WHEN** a signed-in public member requests an experience suggestion
- **AND** they have a confirmed public contact for whom they have not shared an experience
- **THEN** the system returns that contact's public identifier, display name, and username

#### Scenario: Contact has already written about the member

- **WHEN** a confirmed public contact has shared an experience about the signed-in member
- **AND** the signed-in member has not shared a matching experience
- **THEN** that contact remains eligible as an experience suggestion

#### Scenario: Member has no eligible contact

- **WHEN** every contact is pending, unavailable, blocked, or already has an experience from the signed-in member
- **THEN** the system returns no experience suggestion

#### Scenario: Visitor requests a suggestion

- **WHEN** a visitor requests an experience suggestion
- **THEN** the system denies access
