## ADDED Requirements

### Requirement: Optional hosting description acknowledgement

Hosts SHALL be able to require acknowledgement of their hosting description
before another member sends a message in a new conversation. The preference
SHALL default to disabled and SHALL be editable with the hosting description.

#### Scenario: First contact with an opted-in host

- **GIVEN** the recipient's hosting offer requires acknowledgement
- **AND** the two members have no existing conversation
- **WHEN** the sender opens the composer
- **THEN** the hosting description appears above the composer
- **AND** an initially unchecked acknowledgement is required to send
- **AND** the server rejects a send request without literal boolean acknowledgement

#### Scenario: Acknowledged first message

- **GIVEN** a new conversation with an opted-in host
- **WHEN** the sender ticks the acknowledgement and sends
- **THEN** the message is sent subject to the usual messaging checks

#### Scenario: Existing conversation or disabled preference

- **GIVEN** either member has already started a conversation, or the host has not opted in
- **WHEN** a member sends a message
- **THEN** no hosting description acknowledgement is required

#### Scenario: Preference or description cannot be loaded

- **GIVEN** a new conversation
- **WHEN** the hosting offer cannot be loaded
- **THEN** the composer does not allow an unchecked first message to bypass the requirement

#### Scenario: Expired legacy hosting offer

- **GIVEN** a legacy hosting offer has expired and is hidden from guests
- **WHEN** a guest starts a conversation with its owner
- **THEN** that expired offer does not require acknowledgement
