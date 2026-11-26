## ADDED Requirements

### Requirement: iOS simulator coverage visibility

Continuous integration SHALL collect Xcode line coverage when the iOS
simulator test job runs, publish a readable application-target summary to the
GitHub Actions step summary, and upload the machine-readable coverage summary
as a workflow artefact. Test bundles SHALL be excluded from the published
application totals. A pull-request check named **iOS coverage** SHALL fail when
the summary artefact is missing after the simulator tests succeed.

#### Scenario: Simulator tests complete with coverage enabled

- **WHEN** the iOS simulator test job finishes successfully
- **THEN** the job retains an `.xcresult` bundle produced with code coverage
  enabled
- **AND** a markdown summary of application line coverage appears in the job
  step summary
- **AND** a JSON coverage summary artefact is uploaded for the workflow run

#### Scenario: Named coverage check

- **WHEN** a pull request runs the iOS workflow after a successful simulator
  test job
- **THEN** GitHub shows an **iOS coverage** check
- **AND** that check republishes the coverage summary and fails if the summary
  artefact is absent

#### Scenario: Test bundles do not inflate the headline

- **WHEN** the coverage summary is generated from `xccov` JSON
- **THEN** targets whose names end with `.xctest` or `Tests` are omitted from
  the published application line totals
