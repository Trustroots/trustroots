## MODIFIED Requirements

### Requirement: Conversation creation and replies

The system SHALL let eligible members start a conversation and send a reply,
while rejecting invalid recipients and empty message content. Before an
opening message is sent, and until the current member sends their first reply,
the conversation experience SHALL provide a link to the public safety guidance.

#### Scenario: Member opens a new conversation

- **WHEN** a member opens a conversation with no messages
- **THEN** the empty state provides a link to the public safety guidance

#### Scenario: Member has not replied to an incoming conversation

- **WHEN** a member opens a conversation containing messages only from the
  other member
- **THEN** the reply experience provides a link to the public safety guidance

#### Scenario: Member sends an opening message

- **WHEN** a member sends a valid opening message to another eligible member
- **THEN** the system creates the conversation and displays the message

#### Scenario: Member submits an empty message

- **WHEN** a member submits an empty reply
- **THEN** the system rejects the reply and displays validation feedback
