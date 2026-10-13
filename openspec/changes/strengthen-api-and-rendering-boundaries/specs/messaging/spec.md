## ADDED Requirements

### Requirement: Explicit conversation acknowledgement

Conversation GET requests SHALL leave persisted read state unchanged. The
message-read POST SHALL accept only an array of valid message identifier strings
and SHALL scope changes to the authenticated recipient. It SHALL mark a thread
read only when its latest message is included in the acknowledgement.

#### Scenario: Member retrieves a conversation

- **WHEN** a member retrieves conversation history through GET
- **THEN** persisted message and thread read state remains unchanged

#### Scenario: Member acknowledges the latest message

- **WHEN** a member acknowledges the latest incoming message through POST
- **THEN** that message and its thread are marked read

#### Scenario: Member acknowledges an older message

- **WHEN** a member acknowledges only an older incoming message
- **THEN** the unread latest message keeps the thread unread

### Requirement: Literal message previews

Inbox previews SHALL display plain-text excerpts as literal text.

#### Scenario: Preview contains markup characters

- **WHEN** an excerpt contains markup characters
- **THEN** those characters are visible text rather than page elements
