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

### Requirement: Message status synchronisation

The system SHALL provide a member's unread-message state and update it when
messages are read or synchronised.

#### Scenario: Member reads a message

- **WHEN** a member reads an unread message
- **THEN** the system updates the unread state available to that member

### Requirement: Moderation-safe reply statistics

The system SHALL exclude messages hidden by restricted-member moderation rules
from reply-rate and reply-time accounting.

#### Scenario: Restricted member sends a shadow-hidden message

- **WHEN** a suspended or shadowbanned member sends a message that is hidden
  from its recipient by moderation rules
- **THEN** the message does not create or update reply statistics

#### Scenario: Available member sends a visible message

- **WHEN** an available member sends a visible message
- **THEN** normal reply-rate and reply-time accounting continues

### Requirement: Staff exemption from message recipient throttling

The system SHALL exempt authenticated senders with the `welcome-team` or `admin` role from the distinct-recipient message throttle. All other message validation and moderation rules SHALL continue to apply. Senders without either role SHALL remain subject to the configured throttle.

#### Scenario: Welcome team or administrator exceeds the recipient limit

- **GIVEN** a sender has either the `welcome-team` or `admin` role and has exceeded the recipient limit
- **WHEN** they send an otherwise valid message
- **THEN** the message is accepted without applying the recipient throttle

#### Scenario: Ordinary member exceeds the recipient limit

- **GIVEN** a sender has neither exempt role and has exceeded the recipient limit
- **WHEN** they send a message
- **THEN** the system rejects the message with HTTP 429

#### Scenario: Exempt role is removed

- **GIVEN** a sender has exceeded the recipient limit and no longer has either exempt role
- **WHEN** they next send a message
- **THEN** the system applies the ordinary recipient throttle

### Requirement: React messaging pages

The system SHALL render the inbox and conversation pages with the React
application shell while preserving existing messaging access and behaviour.

#### Scenario: Member opens the inbox

- **WHEN** an authenticated member opens `/messages`
- **THEN** the React shell displays their conversations and unread count
- **AND** inbox pagination continues to use the existing message API

#### Scenario: Member opens and replies to a conversation

- **WHEN** an authenticated member opens `/messages/:username`
- **THEN** the React shell displays the existing thread and reply controls
- **AND** read state and unread count update through the existing APIs

#### Scenario: Angular page links to messaging

- **WHEN** a member follows an Angular named-state link to the inbox or thread
- **THEN** the browser opens the matching React-owned URL

#### Scenario: Visitor opens a messaging page

- **WHEN** a signed-out visitor opens a messaging URL
- **THEN** the page redirects to sign in without displaying messages
