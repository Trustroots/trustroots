## ADDED Requirements

### Requirement: Agenda storage history and job inventory

The system SHALL show administrators daily aggregate storage snapshots for `agendaJobs` and `agendaJobsArchived` for the latest 30 UTC dates, and a current job inventory grouped by name with state counts, total documents, uncompressed BSON size, and the oldest completed run. The system SHALL exclude job payloads and individual job records from the diagnostics.

#### Scenario: Worker captures Agenda storage

- **WHEN** the recurring capture succeeds
- **THEN** the system stores one aggregate snapshot for the UTC date without duplicating an existing reading for that date
- **AND** older snapshots outside the 30-date window are pruned

#### Scenario: Administrator opens the job inventory

- **WHEN** live inventory statistics are available
- **THEN** the administrator sees each job type ordered by BSON size, alongside its counts and oldest completed run
- **AND** the dashboard labels BSON size as uncompressed document size

#### Scenario: Live inventory exceeds the request budget

- **WHEN** the administrator opens the dashboard after the worker has captured an inventory
- **THEN** the dashboard shows the saved inventory with its capture timestamp
- **AND** an explicit refresh attempts a live read and falls back to the saved inventory on failure
