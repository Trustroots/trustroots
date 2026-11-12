## ADDED Requirements

### Requirement: MongoDB diagnostics for administrators

The system SHALL provide a read-only administrator dashboard at `/admin/mongo` for inspecting MongoDB migration context and Agenda storage.

#### Scenario: Administrator inspects the MongoDB upgrade path

- **WHEN** an administrator opens or refreshes the dashboard
- **THEN** it shows the connected MongoDB server version, topology and feature compatibility version (FCV) when available
- **AND** it shows the 4.4 → 5.0 → 6.0 → 7.0 path, distinguishes an in-progress FCV transition from an aligned or mismatched version, and links to the migration runbook and rollout issue
- **AND** unavailable readings are labelled individually and the dashboard does not certify rollout readiness

#### Scenario: Administrator inspects Agenda storage

- **WHEN** an administrator opens or refreshes the dashboard
- **THEN** it shows a UTC snapshot time and document counts, allocated data bytes, index bytes and reusable data bytes when available for the live and archived Agenda collections
- **AND** it distinguishes an absent collection from unavailable statistics
- **AND** it shows live job counts by name and state without exposing job payloads

#### Scenario: Non-administrator requests MongoDB diagnostics

- **WHEN** a request lacks the administrator role
- **THEN** the system denies access before reading diagnostics
