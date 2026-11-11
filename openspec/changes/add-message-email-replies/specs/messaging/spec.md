## ADDED Requirements

### Requirement: Optional email replies

When configured, the system SHALL allow a notified member to reply to their
existing conversation by replying to the notification email. Each reply address
SHALL be private, expiring and scoped to that member and conversation. The web
reply link SHALL remain available.

#### Scenario: Member replies to a notification

- **WHEN** an eligible member sends a non-empty reply from their current account
  email to a valid reply address
- **THEN** the reply appears in the existing conversation with normal message
  formatting, delivery, notification and statistics behaviour
- **AND** recognised quoted notification content is excluded

#### Scenario: Invalid or automated email

- **WHEN** an email has an invalid or expired reply address, a different sender,
  an ineligible member, automated content, excessive size or no reply text
- **THEN** no member message is created

#### Scenario: Duplicate delivery or interrupted processing

- **WHEN** the same inbound delivery is processed again
- **THEN** no duplicate message is created
- **AND** incomplete conversation updates can be retried

#### Scenario: Email replies are disabled

- **WHEN** the feature is disabled
- **THEN** notifications keep the existing web-only reply instructions
- **AND** the worker does not ingest member replies

### Requirement: Read-only email reply diagnostics

The system SHALL provide `/admin/email-replies` and an administration navigation
entry labelled Email replies, restricted to administrators on both the page and
its APIs. It SHALL support pre-activation inspection and ongoing operational
diagnostics without creating member messages, acknowledging mail, changing read
flags or triggering retries through inspection actions.

#### Scenario: Administrator checks mailbox health

- **WHEN** an administrator opens the diagnostics page
- **THEN** the page distinguishes unconfigured, disabled, preview and active modes
- **AND** shows the last poll attempt, last successful poll and sanitised error
  information when available, without exposing mailbox credentials or reply tokens
- **AND** missing configuration or a failed poll is not displayed as an empty inbox

#### Scenario: Administrator reviews incoming replies

- **WHEN** an administrator lists email replies
- **THEN** a paginated table shows received time, sender, matching result,
  processing status and a reason for rejection or failure
- **AND** status filters and a date/time range allow historical investigation
- **AND** dates use `yyyy-mm-dd hh:mm` with an explicit time zone, future range
  values are visibly clamped to now and the resulting range is validated
- **AND** status indicators have text labels as well as any colour

#### Scenario: Administrator inspects a parsing result

- **WHEN** an administrator opens a reply's details
- **THEN** the page shows escaped plain-text source and extracted reply previews,
  the recognised quote boundary and validation results
- **AND** explains any candidate conversation match and its supporting evidence
- **AND** suppresses credentials and bearer reply tokens from diagnostic output
- **AND** does not render email HTML or load external email resources

#### Scenario: An existing reply has no conversation token

- **WHEN** an administrator previews a historical reply without a valid token
- **THEN** the page identifies it as a legacy reply and reports whether a candidate
  match is found, absent or ambiguous
- **AND** thread headers alone are not treated as proof of sender identity
- **AND** a candidate match does not cause automatic message delivery

#### Scenario: A delivered reply has been acknowledged by the provider

- **WHEN** an administrator searches recent processing history
- **THEN** retained outcome records remain inspectable after provider acknowledgement
- **AND** the page states the configured retention window and distinguishes expired
  detail from missing or failed processing

#### Scenario: A non-administrator requests diagnostics

- **WHEN** a signed-out visitor or a member without the admin role requests the
  page, a list endpoint or an individual reply's details
- **THEN** access is denied without revealing reply content or operational metadata
