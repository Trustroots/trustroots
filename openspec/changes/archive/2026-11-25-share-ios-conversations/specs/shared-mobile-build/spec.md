## ADDED Requirements

### Requirement: Regular iOS conversations use shared Compose

The regular iOS app SHALL display conversation history and multiline replies in Compose.
It SHALL use the existing iOS session, message cache, read tracking and profile
and Experience routes. It SHALL keep unsent drafts in protected storage scoped
to the server, account and recipient. A failed send SHALL leave the draft
available for explicit retry. A successful send SHALL clear that draft and
show the new reply.

#### Scenario: Retry a failed reply after relaunch

- **GIVEN** a member opens a regular iOS conversation
- **WHEN** they write a reply, delivery fails and they relaunch the app
- **THEN** the conversation restores the unsent reply and its cached history when available
- **AND** a successful manual retry displays the reply and clears the draft
