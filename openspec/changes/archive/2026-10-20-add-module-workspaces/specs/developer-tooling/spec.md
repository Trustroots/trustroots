## ADDED Requirements

### Requirement: Feature modules have validated workspace manifests

Feature modules SHALL be private source-only pnpm workspace packages. Their workspace dependencies SHALL match the recorded module graph, and CI SHALL reject stale manifests. A developer command SHALL select affected module lint and client test tasks while full CI checks and coverage requirements remain enforced.

#### Scenario: Module dependencies change

- **WHEN** the recorded module graph changes without regenerating manifests
- **THEN** manifest validation fails and identifies the stale manifests

#### Scenario: Developer runs affected checks

- **WHEN** affected checks run against a base revision
- **THEN** workspace tooling selects affected module lint and client test tasks
- **AND** project type checks still run

#### Scenario: Production image installs workspace dependencies

- **WHEN** the production image installs and prunes dependencies
- **THEN** module manifests are available and pruning runs without an interactive prompt
