## ADDED Requirements

### Requirement: Regular iOS conversation uses shared message history

The regular iOS conversation SHALL display incoming and outgoing history using
the same Compose component as the pilot. It SHALL initially show the newest
message and return to it after sending a reply or focusing the reply field.
The iOS host SHALL retain its reply field, profile navigation, experience
actions and read-state updates.

#### Scenario: Read and reply in the regular iOS conversation

- **GIVEN** a signed-in member opens a conversation with existing messages
- **WHEN** they read the history and send a reply
- **THEN** the reply appears at the newest end of the shared history
- **AND** returning to the inbox preserves its filter and displays the updated read state

#### Scenario: Retry a rejected reply

- **GIVEN** a signed-in member has written a reply in a conversation
- **WHEN** the server rejects their send
- **THEN** the conversation displays the error and keeps the reply text available for manual retry
