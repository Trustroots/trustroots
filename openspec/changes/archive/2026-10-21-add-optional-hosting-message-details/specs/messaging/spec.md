## REMOVED Requirements

### Requirement: Optional hosting description acknowledgement

**Reason**: Acknowledgement belongs to hosting messages, rather than all first contact.
**Migration**: Existing preference values remain; they now apply to the first hosting message.

## ADDED Requirements

### Requirement: Hosting details in ordinary conversations

Members SHALL be able to opt into hosting mode in the existing message composer.
Hosting messages SHALL remain messages in the same conversation and SHALL include
a guest count defaulting to one. Arrival and departure SHALL either both be absent
or be real calendar dates with departure after arrival. The guest count SHALL be
an integer from one to one hundred. Ordinary messages SHALL remain available.

#### Scenario: Dates unknown

- **WHEN** a member sends a hosting message without dates
- **THEN** its guest count and text appear in the conversation
- **AND** no dates are invented

#### Scenario: Invalid visit details

- **WHEN** hosting details have a partial or invalid date range or invalid guest count
- **THEN** sending is rejected without saving a message

### Requirement: Hosting description reminder and acknowledgement

Hosting mode SHALL show the recipient's active hosting description and a gentle
reading reminder. The optional host preference SHALL require an initially
unchecked acknowledgement only for the first hosting message visible in the
conversation. Ordinary message history SHALL not count as a hosting message.
The server SHALL determine this using all visible history, not a page of results.
Expired offers and incoming shadow-hidden history SHALL be ignored.

#### Scenario: Ordinary contact

- **WHEN** a member sends an ordinary message to an opted-in host
- **THEN** no hosting acknowledgement is required

#### Scenario: First hosting message after ordinary messages

- **GIVEN** a host opted in and no visible hosting message exists between the members
- **WHEN** either member sends hosting details to that host
- **THEN** literal boolean acknowledgement is required
- **AND** an unchecked send is rejected without saving a message

#### Scenario: Later hosting message

- **GIVEN** a visible hosting message already exists in the conversation
- **WHEN** another hosting message is sent
- **THEN** no repeated acknowledgement is required

#### Scenario: Preference changes while composing

- **WHEN** the server rejects a hosting send because acknowledgement became required
- **THEN** the client refreshes hosting context and keeps the text and visit details

#### Scenario: Hosting context cannot be loaded

- **WHEN** hosting context loading fails
- **THEN** hosting mode offers a retry and does not send until context is loaded
- **AND** the member can switch back to an ordinary message

### Requirement: Contextual hosting replies

Hosting reply shortcuts SHALL appear only when an incoming hosting message exists
after the member's latest outgoing message. Shortcuts SHALL send ordinary messages
using the existing yes/no hosting reply format, without creating booking status.

#### Scenario: Ordinary incoming message

- **WHEN** the latest unanswered incoming messages have no hosting details
- **THEN** hosting reply shortcuts are absent

#### Scenario: Hosting question and response

- **WHEN** an incoming hosting message has not been answered
- **THEN** hosting reply shortcuts are available
- **AND** sending a reply hides them until a later incoming hosting message
