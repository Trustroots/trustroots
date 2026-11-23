## ADDED Requirements

### Requirement: oxlint and oxfmt check the repository

The repository SHALL lint JavaScript and TypeScript with oxlint and format supported files with oxfmt, both configured in TypeScript files at the repository root. Local lint, module lint tasks and CI SHALL fail on oxlint errors and on files oxfmt would change.

#### Scenario: A change is not formatted

- **WHEN** a file differs from oxfmt's output
- **THEN** `pnpm lint` and CI fail

#### Scenario: Client JSX is inaccessible

- **WHEN** client JSX breaks a jsx-a11y rule from the repository configuration
- **THEN** oxlint reports a blocking error

## MODIFIED Requirements

### Requirement: CI avoids repeated tooling work

CI SHALL run oxlint once and use its output for both annotations and enforcement.
Client checks SHALL run on Node 24 with the pinned pnpm version independently
of the development Docker image. End-to-end groups SHALL reuse one asset build
from the same checkout and retain all existing tests and coverage requirements.

#### Scenario: Application PR runs CI

- **WHEN** application CI runs
- **THEN** all existing client checks run directly on Node 24
- **AND** one shared end-to-end asset build supplies all three test groups
- **AND** lint failures fail CI

#### Scenario: End-to-end asset build fails

- **WHEN** the shared asset build fails
- **THEN** dependent end-to-end groups cannot report a successful test run
