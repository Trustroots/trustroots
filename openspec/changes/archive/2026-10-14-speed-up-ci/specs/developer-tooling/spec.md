## ADDED Requirements

### Requirement: CI timing overview

The PR and HTML coverage overviews SHALL show a snapshot of CI job and step
durations with log links, distinguish elapsed workflow time from accumulated
job time, and label incomplete or unavailable timing data without claiming
the reporting job has finished. Reporting SHALL use the current run attempt
and the matching PR head for a companion lint workflow.

#### Scenario: Parallel test jobs finish

- **WHEN** CI generates the overview
- **THEN** completed jobs and their steps show their durations and log links
- **AND** elapsed time is shown separately from accumulated completed job time
- **AND** the slowest completed step is highlighted

#### Scenario: Timing data is incomplete

- **WHEN** a workflow is still running or the API cannot supply timings
- **THEN** the overview identifies the snapshot or unavailable data
- **AND** timing collection does not bypass test or coverage enforcement

### Requirement: CI avoids repeated tooling work

CI SHALL run ESLint once and reuse its output for annotations and enforcement.
Client checks SHALL run on Node 24 with the pinned pnpm version independently
of the development Docker image. End-to-end groups SHALL reuse one asset build
from the same checkout and retain all existing tests and coverage requirements.

#### Scenario: Application PR runs CI

- **WHEN** application CI runs
- **THEN** all existing client checks run directly on Node 24
- **AND** one shared end-to-end asset build supplies all three test groups
- **AND** lint failures still fail CI even if annotation reporting fails

#### Scenario: End-to-end asset build fails

- **WHEN** the shared asset build fails
- **THEN** dependent end-to-end groups cannot report a successful test run
