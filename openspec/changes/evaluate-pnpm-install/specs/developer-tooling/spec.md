## ADDED Requirements

### Requirement: Package manager changes are evidence-led

The project SHALL compare clean and repeat dependency installation time and
validate development and production container installation before changing
the supported package manager.

#### Scenario: Maintainer compares package managers

- **WHEN** the package-manager benchmark runs against the same lockfile inputs
  and runtime
- **THEN** it records cold and warm install duration for each available manager
- **AND** it does not modify the repository's supported package manager

#### Scenario: Container compatibility is evaluated

- **WHEN** a candidate package manager is trialled in development and
  production containers
- **THEN** the report records install completion and required native build
  scripts
- **AND** npm remains supported until the evaluation explicitly recommends a
  separate migration
