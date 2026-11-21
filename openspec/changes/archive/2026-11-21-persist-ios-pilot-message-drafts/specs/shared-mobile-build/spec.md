## ADDED Requirements

### Requirement: The iOS pilot keeps unsent replies on the device

The iOS Compose pilot SHALL save unsent replies in protected local storage,
scoped to the authenticated server, account and conversation recipient. The
same account SHALL be able to reopen its drafts after relaunch or signing back
in. The pilot SHALL remove a draft when its content is deleted or its send
succeeds, and SHALL leave it available for manual retry after failure.

#### Scenario: Reopen a conversation after a failed send

- **GIVEN** a signed-in member writes a reply that fails to send
- **WHEN** they relaunch the pilot and reopen the same conversation
- **THEN** the composer restores the unsent reply
- **AND** the reply is only sent when the member retries
- **AND** a successful retry clears the stored draft

#### Scenario: Read drafts from the current account and server

- **GIVEN** a draft was written for one recipient on one account and server
- **WHEN** the pilot opens a different recipient, account or server
- **THEN** it does not display the first draft
