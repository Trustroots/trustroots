## ADDED Requirements

### Requirement: Finish-signup reminder delivery

The system SHALL not send finish-signup reminder emails to suspended or
shadowbanned members.

#### Scenario: Restricted member remains incomplete

- **WHEN** a suspended or shadowbanned member otherwise meets a finish-signup
  reminder job's timing and profile criteria
- **THEN** the job does not select that member for email delivery
