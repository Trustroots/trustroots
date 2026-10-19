## ADDED Requirements

### Requirement: Messaging without external spam classification

The system SHALL send eligible member messages without contacting an external spam-classification service. New messages SHALL have no automatically assigned spam classification. Existing stored spam flags SHALL remain readable, and existing delivery, notification, throttling, blocking and manual moderation behaviour SHALL remain unchanged.

#### Scenario: A member sends a message

- **WHEN** an eligible member sends a valid message
- **THEN** the message is saved and available to its recipient without external classification or a new spam flag
- **AND** the conversation and notification state follows the existing delivery rules

#### Scenario: A restricted sender sends a message

- **WHEN** a suspended or shadowbanned member uses the existing restricted delivery path
- **THEN** the existing hidden-delivery behaviour remains in effect

#### Scenario: A historical message has a stored classification

- **WHEN** historical message metadata is read or processed for statistics
- **THEN** its stored spam classification is preserved
