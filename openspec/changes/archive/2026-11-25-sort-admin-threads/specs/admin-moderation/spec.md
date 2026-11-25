## ADDED Requirements

### Requirement: Sortable administration thread overview

The admin thread overview SHALL support keyboard sorting on From, To, Status, Thread votes, First message and Last message. It SHALL show the active column and direction visually and through the column header's accessible sort state. Each vote SHALL show its recorded timestamp in UTC yyyy-mm-dd hh:mm format, or a placeholder if unavailable, and SHALL expose the vote's positive or negative meaning to assistive technology.

#### Scenario: Administrator sorts filtered threads

- **WHEN** an administrator activates a sortable heading
- **THEN** the table sorts by the selected column while retaining the member and vote filters
- **AND** activating the same heading again reverses the direction
- **AND** message dates sort chronologically and vote counts sort numerically

#### Scenario: Administrator reads an individual vote

- **WHEN** an administrator views a thread with votes
- **THEN** each displayed vote shows its sign and recorded date and time alongside the voter and recipient

## MODIFIED Requirements

### Requirement: Readable member thread overview

The admin thread page SHALL use username-based navigation and display conversations in a table with participants, read status, directional thread votes and first and last message datetimes. Message datetimes SHALL use UTC yyyy-mm-dd hh:mm format and SHALL come from actual messages in either direction. Missing values SHALL display a placeholder. The page SHALL omit the member query input and raw thread details.

#### Scenario: Administrator opens a member's threads

- **WHEN** the administrator follows the member's thread link
- **THEN** the URL identifies the member by username
- **AND** the table shows the member's conversation participants, votes and message datetimes
- **AND** the conversation link uses usernames

#### Scenario: Legacy identifier link

- **WHEN** the administrator opens a legacy userId link for an existing member
- **THEN** the system resolves that member and replaces the URL with its username equivalent
- **AND** the same conversations are available

#### Scenario: Messages in both directions

- **WHEN** a thread contains messages sent by both participants
- **THEN** its first and last datetime cover both directions
- **AND** votes are attributed to their author and recipient
