## MODIFIED Requirements

### Requirement: External message links are inert

The system SHALL display all links in message bodies and draft previews as non-clickable text while preserving visible labels and supported formatting, including links to the current Trustroots origin. The rule SHALL apply to previously stored messages as well as new messages.

#### Scenario: Member views an external link in a message

- **WHEN** a member opens a conversation containing a message with an external link
- **THEN** its label is visible without a clickable link

#### Scenario: Member views an internal link in a message

- **WHEN** a member opens a conversation containing a link to the current Trustroots origin
- **THEN** its label is visible without a clickable link
