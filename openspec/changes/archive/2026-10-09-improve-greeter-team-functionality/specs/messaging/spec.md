## ADDED Requirements

### Requirement: Representative reply statistics

Reply statistics SHALL exclude deleted senders and conversations started by current `welcome-team` members before the existing statistics window selection. Fewer than three selected eligible conversations SHALL yield null reply rate and time, formatted as empty strings. Three or more eligible conversations SHALL retain the existing calculation, including a legitimate zero reply rate. Current roles SHALL apply to historical conversations without migration.

#### Scenario: Welcome conversations leave an insufficient sample

- **WHEN** excluding current greeter conversations leaves fewer than three eligible conversations
- **THEN** both reply statistics are unavailable

#### Scenario: Three unanswered eligible conversations

- **WHEN** three eligible conversations have no replies
- **THEN** reply rate is zero and reply time is unavailable

### Requirement: Named empty conversation

An empty conversation SHALL display translatable text identifying the recipient by public display name, falling back to username and then the existing generic text. The name SHALL be selectable text and safely interpolated.

#### Scenario: Recipient has a display name

- **WHEN** a member opens an empty conversation with a named recipient
- **THEN** the heading says they have not been talking with that name yet
