## ADDED Requirements

### Requirement: MongoDB index and maintenance status for administrators

The MongoDB diagnostics dashboard SHALL show the names and key definitions of indexes on collections in the connected application database when available. It SHALL use metadata reads and restrict access to administrators.

#### Scenario: Administrator checks indexes after a restore

- **WHEN** an administrator opens or refreshes MongoDB diagnostics
- **THEN** the dashboard shows each available collection's installed indexes
- **AND** it checks the expected circle discovery indexes against the connected database
- **AND** it distinguishes an installed matching definition, an absent index, a different definition and unavailable metadata
- **AND** the check describes the current state and does not claim an execution history

#### Scenario: Index metadata cannot be read

- **WHEN** collection index metadata cannot be read
- **THEN** the dashboard labels the affected information unavailable
- **AND** the server version, upgrade context and Agenda diagnostics remain available independently
