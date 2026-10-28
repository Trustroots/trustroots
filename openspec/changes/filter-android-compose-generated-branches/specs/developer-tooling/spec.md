## MODIFIED Requirements

### Requirement: Auditable Android executable-line coverage

Android coverage SHALL remove only bytecode-proven compiler instructions before aggregating line and branch counters. Application behaviour and uncertain paths SHALL remain measured. Reports SHALL preserve raw XML, an instruction audit and reconciled generated-branch counter differences.

#### Scenario: Proven generated line

- **WHEN** a compiled method contains a structurally recognised compiler-only sequence
- **THEN** the report removes only those instructions and generated decisions and records their bytecode evidence
- **AND** the raw measurement remains unchanged and available

#### Scenario: Proven generated decision

- **WHEN** a recognised compiler-only instruction sequence contains a generated branch
- **THEN** the report removes that decision and reconciles its counter difference with the raw report
- **AND** application branch outcomes remain measured

#### Scenario: Similar application code

- **WHEN** an application conditional, callable target or ordinary source lambda resembles compiler scaffolding
- **THEN** its instructions and decisions remain measured

#### Scenario: Complete measurement

- **WHEN** the coverage ratchet is raised
- **THEN** it uses complete matching Android unit and device execution probes, including API 32 compatibility coverage
- **AND** the corrected report retains 100% executable lines and meets the measured branch floor
