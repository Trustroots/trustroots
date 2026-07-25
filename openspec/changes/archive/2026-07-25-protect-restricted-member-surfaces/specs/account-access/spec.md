## ADDED Requirements

### Requirement: Welcome-sequence delivery

The system SHALL not send welcome-sequence emails to suspended or shadowbanned
members.

#### Scenario: Restricted member is eligible for a welcome-sequence step

- **WHEN** a suspended or shadowbanned member otherwise meets a
  welcome-sequence job's timing and profile criteria
- **THEN** the job does not select that member for email delivery
