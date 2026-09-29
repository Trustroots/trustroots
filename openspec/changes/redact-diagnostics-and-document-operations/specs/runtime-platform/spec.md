## ADDED Requirements

### Requirement: Redact sensitive diagnostic metadata

The system SHALL redact credentials, recovery tokens and private message payloads from structured diagnostic metadata before sending it to configured logging transports. Redaction SHALL preserve non-sensitive event metadata, avoid mutating caller objects and remain bounded for cyclic or oversized metadata.

#### Scenario: Diagnostic metadata contains credentials

- **WHEN** an event contains nested passwords, recovery tokens or private message payloads
- **THEN** the transport receives redacted values while retaining non-sensitive diagnostic fields

#### Scenario: Metadata is cyclic or unusually deep

- **WHEN** diagnostic metadata contains a cycle or exceeds the traversal bound
- **THEN** logging completes with bounded placeholder values without throwing or exposing the skipped payload
