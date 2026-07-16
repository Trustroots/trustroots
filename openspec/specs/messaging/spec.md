# Messaging Specification

## Purpose

Let eligible members communicate privately while protecting message visibility
and conversation state.

## Requirements

### Requirement: Member-only messaging

The system SHALL require an eligible signed-in member for messaging APIs and
messaging pages.

#### Scenario: Signed-out visitor opens messaging

- **WHEN** a signed-out visitor opens a messaging route or API
- **THEN** the system requires the visitor to sign in

#### Scenario: Unconfirmed member opens messaging

- **WHEN** an unconfirmed member opens their inbox
- **THEN** the system prompts them to confirm their profile
- **AND** restricted messaging actions remain unavailable

### Requirement: Inbox and conversation viewing

The system SHALL show a member's available conversation summaries and let them
open a conversation with its message history.

#### Scenario: Member opens their inbox

- **WHEN** a member opens their inbox
- **THEN** the system displays available conversation summaries

#### Scenario: Member opens a conversation

- **WHEN** a member opens an available conversation
- **THEN** the system displays its message history and paginated replies

### Requirement: Message visibility protection

The system SHALL not show messages or conversation summaries hidden from a
recipient by moderation visibility rules.

#### Scenario: Recipient has a shadow-hidden sender

- **WHEN** a member opens their inbox or a conversation containing a shadow-hidden sender
- **THEN** the hidden sender's messages are not shown to that member

### Requirement: Conversation creation and replies

The system SHALL let eligible members start a conversation and send a reply,
while rejecting invalid recipients and empty message content.

#### Scenario: Member sends an opening message

- **WHEN** a member sends a valid opening message to another eligible member
- **THEN** the system creates the conversation and displays the message

#### Scenario: Member submits an empty message

- **WHEN** a member submits an empty reply
- **THEN** the system rejects the reply and displays validation feedback

### Requirement: Message status synchronisation

The system SHALL provide a member's unread-message state and update it when
messages are read or synchronised.

#### Scenario: Member reads a message

- **WHEN** a member reads an unread message
- **THEN** the system updates the unread state available to that member
