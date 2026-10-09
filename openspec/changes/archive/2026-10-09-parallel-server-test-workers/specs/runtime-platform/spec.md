## ADDED Requirements

### Requirement: Isolated parallel server tests

The project SHALL provide an opt-in parallel server-test command that runs every selected test file exactly once across bounded workers, preserves failure exit status and coverage collection, and isolates worker databases without changing the default serial command.

#### Scenario: Multiple workers run integration tests

- **WHEN** the parallel server-test command starts two or more workers
- **THEN** each worker uses a unique database for that invocation for application records and Agenda jobs
- **AND** fixture cleanup in one worker does not delete records belonging to another worker
- **AND** worker databases are removed after normal completion

#### Scenario: A worker fails or the run is interrupted

- **WHEN** a worker fails or the parent receives an interruption signal
- **THEN** the overall command exits unsuccessfully
- **AND** interruption terminates the active worker processes

#### Scenario: Coverage is collected in parallel

- **WHEN** the parallel command runs under the existing server coverage tooling
- **THEN** coverage from worker processes is combined without lowering existing thresholds or changing exclusions

#### Scenario: Invalid worker configuration

- **WHEN** the worker count or worker database name is invalid
- **THEN** the command rejects the configuration before running tests or clearing a database
