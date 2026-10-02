## ADDED Requirements

### Requirement: Redact sensitive diagnostic metadata

The system SHALL redact credentials, recovery tokens, private message payloads and security-report payloads from structured diagnostic metadata before sending it to configured logging transports. Redaction SHALL preserve stable event descriptions and non-sensitive event metadata, avoid mutating caller objects and remain bounded for cyclic or oversized metadata. Error messages and stacks SHALL be omitted from structured error metadata.

#### Scenario: Diagnostic metadata contains credentials

- **WHEN** an event contains nested passwords, recovery tokens or private message payloads
- **THEN** the transport receives redacted values while retaining non-sensitive diagnostic fields

#### Scenario: Error diagnostics contain private request details

- **WHEN** an Error object is passed as log metadata
- **THEN** the transport receives only safe error classification such as its name, code and status, without its message or stack

#### Scenario: Metadata is cyclic or unusually deep

- **WHEN** diagnostic metadata contains a cycle, an accessor, excessive nesting or more than 1,000 visited entries
- **THEN** logging completes with bounded placeholder values without invoking accessors or exposing skipped payloads
