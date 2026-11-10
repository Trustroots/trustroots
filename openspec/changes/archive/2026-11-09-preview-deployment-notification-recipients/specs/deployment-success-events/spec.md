## ADDED Requirements

### Requirement: Operators can preview deployment notification recipients

The system SHALL provide a read-only operator command that reports the number of
eligible deployment notification destinations. It SHALL require an explicit
production tier, production runtime, canonical production domain and effective
live mail mode before querying user records.

#### Scenario: Preview the production audience

- **WHEN** all production gates pass
- **THEN** the preview counts unique current email destinations for public
  accounts with the greeter or admin role, excluding suspended accounts and
  invalid addresses
- **AND** it deduplicates trimmed, lowercased addresses
- **AND** it reveals only the count and creates no mail jobs

#### Scenario: Reject an ineligible runtime

- **WHEN** a production gate fails
- **THEN** the preview exits unsuccessfully before querying users
