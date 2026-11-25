## ADDED Requirements

### Requirement: Consistent direct-message line breaks

The system SHALL preserve line breaks and interior blank lines in direct-message
drafts, previews, conversations and unread-message emails. Inbox excerpts SHALL
replace line boundaries with spaces. The iPhone composer SHALL support multiline
drafts, with a separate Send action.

#### Scenario: Member sends a multiline message

- **WHEN** a member types or pastes multiple lines with an interior blank line and sends the message
- **THEN** Preview and the delivered message show the same lines and interior blank line
- **AND** the inbox excerpt separates words from adjacent lines with spaces

#### Scenario: Member opens a stored message with line breaks

- **WHEN** a stored direct message contains paragraph breaks, HTML line breaks or literal newlines
- **THEN** the conversation and unread-message email preserve the line boundaries

#### Scenario: Member opens a native conversation

- **WHEN** a native client reads a direct message
- **THEN** the response supplies line-preserving plain text alongside the formatted HTML

## MODIFIED Requirements

### Requirement: Side-effect-free draft formatting

The system SHALL offer authenticated POST /api/messages-preview accepting a
string content field and returning a content field formatted by the same
formatter used when sending a message. Preview SHALL NOT persist messages or
alter threads, read state, notifications or statistics.

#### Scenario: Eligible member requests a preview

- **WHEN** an eligible authenticated member posts draft content
- **THEN** the system returns sanitised, formatted content without message side effects

#### Scenario: Visitor requests a preview

- **WHEN** a signed-out visitor requests a preview
- **THEN** access is denied

#### Scenario: Invalid content is submitted

- **WHEN** the content field is missing, non-string or empty after stripping markup
- **THEN** the system rejects the preview request
