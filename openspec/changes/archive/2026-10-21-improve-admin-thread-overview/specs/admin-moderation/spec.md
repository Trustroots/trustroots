## ADDED Requirements

### Requirement: Readable member thread overview

The admin thread page SHALL use username-based navigation and display conversations in a table with participants, read status, directional thread votes and first and last message datetimes. Datetimes SHALL use UTC yyyy-mm-dd hh:mm format and SHALL come from actual messages in either direction. Missing values SHALL display a placeholder. The page SHALL omit the member query input and raw thread details.

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

### Requirement: Compact administration sidebar

Desktop admin pages SHALL display grouped navigation in a compact sidebar beside the content. Smaller screens SHALL display the navigation above the content. The duplicated Admin brand link SHALL be omitted, and the primary Admin navigation item SHALL remain selected across admin paths.

#### Scenario: Administrator moves between tools

- **WHEN** an administrator visits an admin page on desktop
- **THEN** all authorised navigation groups appear in the sidebar
- **AND** the selected subsection and primary Admin item are highlighted

### Requirement: Readable administration conversations

The admin Messages view SHALL use the standard conversation bubble presentation in a read-only view. Conversation URLs SHALL prefer participant usernames and resolve legacy identifier links. The view SHALL omit manual participant fields, the Read button, raw message details and recipient warning controls. Existing warning APIs and their authorisation SHALL remain unchanged.

#### Scenario: Administrator opens a conversation

- **WHEN** an administrator opens a conversation through participant usernames or a legacy identifier link
- **THEN** messages render as conversation bubbles with sender, read state and formatted timestamps
- **AND** legacy links are replaced by username links when those usernames are available

### Requirement: Consistent administration datetimes

Rendered administration datetimes SHALL use UTC yyyy-mm-dd hh:mm format. Machine-readable timestamps, date input values and export filenames SHALL preserve their established formats.

#### Scenario: Administrator compares activity times

- **WHEN** an administrator views member activity, notes, support cases, audit events or conversations
- **THEN** the displayed datetimes use the same year-first minute-precision format

### Requirement: Support account context and username navigation

Support case details SHALL show account state and roles for linked reporters and reported members. Support member URLs SHALL prefer usernames, accept legacy identifiers and link to the full admin member view for authorised administrators. Existing role permissions SHALL remain in force.

#### Scenario: Staff inspects a support case

- **WHEN** staff opens a case linked to member accounts
- **THEN** the case shows each member's current suspension, shadowban and staff-role badges where applicable
- **AND** account links identify the members by username when available

#### Scenario: Administrator opens a support member

- **WHEN** an administrator opens a support member page through a legacy identifier
- **THEN** the page replaces the URL with the member's username
- **AND** offers a link to that member's full admin account view
