## MODIFIED Requirements

### Requirement: External message links are inert

The system SHALL display external links in message bodies and draft previews as non-clickable text while preserving visible labels and supported formatting. HTTP and HTTPS links to the current Trustroots origin, `trustroots.org`, or any subdomain of `trustroots.org` SHALL remain clickable, including when viewed on a different host. The rule SHALL apply to previously stored messages as well as new messages.

#### Scenario: Member views an external link in a message

- **WHEN** a member opens a conversation containing a message with an external link
- **THEN** its label is visible without a clickable link

#### Scenario: Member views an internal link in a message

- **WHEN** a member opens a conversation containing an HTTP or HTTPS link to the current Trustroots origin, `trustroots.org`, or any subdomain of `trustroots.org`
- **THEN** that link remains clickable
- **AND** draft previews apply the same link rules
