## ADDED Requirements

### Requirement: Moderation-safe reply statistics

The system SHALL exclude messages hidden by restricted-member moderation rules
from reply-rate and reply-time accounting.

#### Scenario: Restricted member sends a shadow-hidden message

- **WHEN** a suspended or shadowbanned member sends a message that is hidden
  from its recipient by moderation rules
- **THEN** the message does not create or update reply statistics

#### Scenario: Available member sends a visible message

- **WHEN** an available member sends a visible message
- **THEN** normal reply-rate and reply-time accounting continues
