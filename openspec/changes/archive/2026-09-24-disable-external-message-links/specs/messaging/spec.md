## ADDED Requirements

### Requirement: External message links are inert

The system SHALL display external links in message bodies as plain text while preserving their visible labels. Links to the current Trustroots origin SHALL remain clickable. The rule SHALL apply to previously stored messages as well as new messages.

#### Scenario: Member views an external link in a message

- **WHEN** a member opens a conversation containing a message with an external link
- **THEN** its label is visible without a clickable link

#### Scenario: Member views an internal link in a message

- **WHEN** a member opens a conversation containing a link to the current Trustroots origin
- **THEN** that link remains clickable
