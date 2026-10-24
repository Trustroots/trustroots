## ADDED Requirements

### Requirement: Evidence-based assessment

The evaluation SHALL compare separate native apps, shared logic with native UI,
and shared logic with Compose UI, using the working native iOS app as a baseline.
It SHALL distinguish source evidence, documented support, estimates and
runtime behaviour that has not been verified.

#### Scenario: Review the documentation-only assessment

- **WHEN** maintainers read the assessment
- **THEN** they can identify reusable code and platform-specific adaptations
- **AND** see compatibility gaps, native iOS tradeoffs and estimated effort
- **AND** see that no Compose iOS build or device journey has been demonstrated

### Requirement: Incremental shared UI migration plan

The assessment SHALL plan shared Kotlin logic and Compose UI within the existing
Android and SwiftUI apps, with acceptance and rollback gates. Its first shared
journey SHALL cover real-API sign-in, profile, inbox, conversation and reply
using existing native secure sessions.

#### Scenario: Plan the first implementation milestone

- **WHEN** the first shared journey is specified for implementation
- **THEN** Compose owns its navigation within the native hosts
- **AND** migrated iOS destinations become defaults after verification
- **AND** native and shared screens use one securely persisted session
- **AND** existing Android behaviour, offline reading and drafts are preserved
- **AND** the plan requires native end-to-end checks on both platforms

### Requirement: Honest completion status

The documentation-only assessment SHALL keep implementation and measured
verification pending without presenting a report as a working iOS build.

#### Scenario: Assessment lands before the prototype

- **WHEN** the assessment PR is completed
- **THEN** issue #3232 remains open for its build demonstration and remaining gates
- **AND** implementation requirements must be validated before subsequent coding
