## ADDED Requirements

### Requirement: Auditable Android executable-line coverage

Android line coverage SHALL remove only bytecode-proven compiler instructions
before aggregating line counters. Application behaviour and uncertain paths
SHALL remain measured. Reports SHALL preserve raw XML, an instruction audit
and unchanged aggregate branch counters.

#### Scenario: Proven generated line

- **WHEN** the compiled method has a recognised generated-only instruction sequence
- **THEN** the executable-line report removes only those instructions before
  aggregating counters and records the evidence while preserving the raw report
- **AND** recognised patterns are exhaustive-enum fallbacks, Compose cleanup,
  implicit coroutine completion and straight-line callable-reference forwarding

#### Scenario: Similar application code

- **WHEN** a line contains application instructions or the bytecode cannot prove
  the generated-only pattern
- **THEN** those instructions remain measured
- **AND** callable targets and ordinary source lambdas remain measured

#### Scenario: Complete measurement

- **WHEN** the line ratchet is raised
- **THEN** it uses a full Android unit and device-suite measurement, including
  API 32 compatibility probes, and verifies deterministic report generation
