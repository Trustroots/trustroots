## MODIFIED Requirements

### Requirement: Regular iOS conversation uses shared message history

The regular iOS conversation SHALL use the pilot's Compose components for
incoming and outgoing history and the reply composer. It SHALL initially show
the newest message and return to it after sending a reply or focusing the
composer. The iOS host SHALL handle delivery, profile navigation, experience
actions and read-state updates.

#### Scenario: Read and reply in the regular iOS conversation

- **GIVEN** a signed-in member opens a conversation with existing messages
- **WHEN** they read the history and send a reply
- **THEN** the reply appears at the newest end of the shared history
- **AND** returning to the inbox preserves its filter and displays the updated read state

#### Scenario: Retry a rejected reply

- **GIVEN** a signed-in member has written a reply in a conversation
- **WHEN** the server rejects their send and they reopen the conversation
- **THEN** the conversation displays the error on failure and restores the draft on reopening
- **AND** a successful retry clears the saved draft

#### Scenario: Keep drafts scoped to the conversation and account

- **GIVEN** a member saves unsent text in a conversation
- **WHEN** they open the conversation under another account or server, or open another recipient
- **THEN** the other conversation does not expose the saved draft
