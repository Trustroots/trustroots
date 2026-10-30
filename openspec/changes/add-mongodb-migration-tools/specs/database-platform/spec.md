## ADDED Requirements

### Requirement: Guarded feature compatibility advancement

FCV advancement SHALL be explicitly invoked with a valid sequential source and
target. The operator tool SHALL verify that the live binary is at the requested
target version and the live FCV equals the requested source before applying an
FCV change, then verify the resulting value. Binary upgrades and FCV changes
SHALL NOT run automatically during application startup.

The FCV command SHALL be restricted to a standalone endpoint unless the tool
can verify all members of another topology before mutation.

#### Scenario: FCV differs from the requested source

- **WHEN** an operator requests an FCV transition whose source differs from the
  live FCV
- **THEN** the tool reports a sanitized failed precondition
- **AND** the database FCV remains unchanged
