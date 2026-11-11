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
