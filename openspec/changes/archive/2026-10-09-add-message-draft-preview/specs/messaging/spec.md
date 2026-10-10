## ADDED Requirements

### Requirement: Optional draft message preview

The composer SHALL offer a translatable, accessible Preview / Edit toggle for non-empty opening messages and replies on desktop and mobile. Preview SHALL display the formatted draft in an outgoing message bubble labelled Message preview, without sent metadata. Send SHALL remain available in both views and SHALL submit the original draft.

#### Scenario: Member previews and edits a draft

- **WHEN** a member selects Preview for a non-empty draft
- **THEN** the composer shows formatted content using existing message formatting and link rules
- **AND** selecting Edit restores the draft and editor focus without changing cached content

#### Scenario: Preview formatting fails or finishes late

- **WHEN** preview formatting fails
- **THEN** the composer offers a retry and preserves the draft
- **AND** responses after leaving preview or changing conversations are ignored

#### Scenario: Member sends from preview

- **WHEN** a member sends from preview
- **THEN** the original draft is submitted through the existing send flow
- **AND** success clears the draft and returns to a focused editor
- **AND** failure preserves the draft and selected view

### Requirement: Side-effect-free draft formatting

The system SHALL offer authenticated POST /api/messages-preview accepting a string content field and returning a content field formatted by the existing server text service. Preview SHALL NOT persist messages or alter threads, read state, notifications or statistics.

#### Scenario: Eligible member requests a preview

- **WHEN** an eligible authenticated member posts draft content
- **THEN** the system returns sanitised, formatted content without message side effects

#### Scenario: Visitor requests a preview

- **WHEN** a signed-out visitor requests a preview
- **THEN** access is denied

#### Scenario: Invalid content is submitted

- **WHEN** the content field is missing, non-string or empty after stripping markup
- **THEN** the system rejects the preview request
