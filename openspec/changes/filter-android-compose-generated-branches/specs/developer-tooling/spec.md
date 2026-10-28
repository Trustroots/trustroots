## MODIFIED Requirements

### Requirement: Auditable Android executable-line coverage

Android coverage SHALL remove only bytecode-proven compiler instructions or verified inlined library guards before aggregating line and branch counters. Application behaviour and uncertain paths SHALL remain measured. Reports SHALL preserve raw XML, an instruction audit and reconciled branch counter differences.

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

#### Scenario: Verified inlined library guard

- **WHEN** an exact Compose contract-guard instruction sequence maps through primary Kotlin SMAP to third-party library source
- **THEN** the report may remove that guard and audit its instruction evidence and source provenance
- **AND** an identical sequence in application source or with uncertain provenance remains measured

#### Scenario: Complete measurement

- **WHEN** the coverage ratchet is raised
- **THEN** it uses complete matching Android unit and device execution probes, including API 32 compatibility coverage
- **AND** the corrected report retains 100% executable lines and meets the measured branch floor
