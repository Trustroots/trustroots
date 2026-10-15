## ADDED Requirements

### Requirement: Duration-aware server test scheduling

Parallel server tests SHALL use available per-file durations to balance workers,
retain deterministic fallback weights for missing timing data, and execute every
selected file exactly once. Timing data SHALL NOT change test selection,
database isolation, failure status or coverage enforcement.

#### Scenario: Timings are available

- **WHEN** a parallel test run has valid durations from an earlier successful run
- **THEN** longer files are allocated first to the worker with the lowest total weight
- **AND** the run records updated durations including suite setup and teardown

#### Scenario: Timings are unavailable

- **WHEN** timing data is missing, malformed or lacks a newly added file
- **THEN** the scheduler uses deterministic estimates for affected files
- **AND** all selected tests still run
