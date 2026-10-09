## MODIFIED Requirements

### Requirement: Inbox and conversation viewing

The system SHALL show a member's available conversation summaries, let them
filter to unread conversations, and let them open a conversation with its message
history. The unread view SHALL include conversations counted by the unread badge
and preserve the filter while paginating. The inbox SHALL let members filter
conversations by the other member's name or username and the latest message
preview, including conversations beyond the first page.

#### Scenario: Member opens their inbox

- **WHEN** a member opens their inbox
- **THEN** the system displays available conversation summaries

#### Scenario: Member filters to unread conversations

- **WHEN** a member selects the unread inbox view
- **THEN** the system displays their unread conversations, including ones older
  than the first page of the full inbox
- **AND** the member can open those conversations

#### Scenario: Member opens a conversation

- **WHEN** a member opens an available conversation
- **THEN** the system displays its message history and paginated replies

#### Scenario: Member filters conversations by text

- **WHEN** a member enters text matching another member or a latest message preview
- **THEN** matching conversations appear even if they were on an older inbox page
