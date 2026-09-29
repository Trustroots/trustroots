## ADDED Requirements

### Requirement: Staff exemption from message recipient throttling

The system SHALL exempt authenticated senders with the `welcome-team` or `admin` role from the distinct-recipient message throttle. All other message validation and moderation rules SHALL continue to apply. Senders without either role SHALL remain subject to the configured throttle.

#### Scenario: Welcome team or administrator exceeds the recipient limit

- **GIVEN** a sender has either the `welcome-team` or `admin` role and has exceeded the recipient limit
- **WHEN** they send an otherwise valid message
- **THEN** the message is accepted without applying the recipient throttle

#### Scenario: Ordinary member exceeds the recipient limit

- **GIVEN** a sender has neither exempt role and has exceeded the recipient limit
- **WHEN** they send a message
- **THEN** the system rejects the message with HTTP 429

#### Scenario: Exempt role is removed

- **GIVEN** a sender has exceeded the recipient limit and no longer has either exempt role
- **WHEN** they next send a message
- **THEN** the system applies the ordinary recipient throttle
