## ADDED Requirements

### Requirement: Isolated complete e2e groups

CI SHALL run three isolated e2e groups whose union contains every product test
and browser combination exactly once, with authentication setup allowed to repeat.

#### Scenario: Group selection

- **WHEN** a group is selected
- **THEN** only its projects and authentication setup run
- **AND** dependencies do not select projects outside that group

#### Scenario: Default local run

- **WHEN** no group is selected
- **THEN** the existing full suite runs

### Requirement: Complete aggregate coverage

CI SHALL enforce complete feature coverage after aggregating all three reports.

#### Scenario: Successful groups

- **WHEN** all groups pass and their combined feature scenarios are complete
- **THEN** the aggregate check passes and links to each group's HTML report

#### Scenario: Incomplete or failed groups

- **WHEN** a group fails or its report is missing or malformed
- **THEN** the aggregate check fails and available failure artefacts remain accessible

### Requirement: Preserve coverage while reducing setup

API-only checks SHALL authenticate without opening a browser. Duplicate checks
SHALL only be removed with equivalent integration coverage and retained browser journeys.

#### Scenario: Password change

- **WHEN** duplicate API password coverage is consolidated
- **THEN** server routes cover missing current passwords and sensitive-field filtering
- **AND** the browser covers visible validation, successful submission and subsequent login
