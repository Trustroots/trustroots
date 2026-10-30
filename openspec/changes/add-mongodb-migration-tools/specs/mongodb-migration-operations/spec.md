## ADDED Requirements

### Requirement: Sanitized read-only migration inspection

The migration tool SHALL provide an explicitly invoked read-only inspection
that reports the server binary version, FCV and topology health. It SHALL use a
required operator-supplied MongoDB URI and SHALL NOT emit credentials, endpoint
identifiers, database names, raw driver errors or database content.

#### Scenario: Operator inspects a deployment

- **WHEN** an operator invokes `inspect` with `MONGODB_URI` set
- **THEN** the tool reports allowlisted server/FCV/topology observations and a
  UTC timestamp
- **AND** it does not issue a write command or expose connection or document
  values

### Requirement: Application and index verification

The migration tool SHALL provide a read-only verification of registered
application model reads and declared indexes. Verification SHALL disable
automatic index and collection creation and SHALL report only aggregate counts
and safe failure codes.

#### Scenario: Operator verifies application readiness

- **WHEN** an operator invokes `verify` against a deployment
- **THEN** the tool runs bounded ID-only reads and checks declared index
  definitions without creating, modifying or dropping database objects
- **AND** the report contains no document values or index names

### Requirement: Explicit sequential FCV advancement

The migration tool SHALL change FCV only through an explicit `advance-fcv`
command with source and target versions supplied by the operator. It SHALL
accept only 4.4→5.0, 5.0→6.0 and 6.0→7.0, verify current binary and FCV values
and a writable standalone endpoint before issuing the FCV command, then verify the
resulting FCV. It SHALL NOT upgrade binaries or run during normal application
startup.

#### Scenario: Operator advances FCV after binary upgrade

- **WHEN** current binary version equals the explicit target, current FCV equals
  the explicit source, and the endpoint is a writable standalone server
- **THEN** the tool issues one version-appropriate FCV command and reads back
  the target FCV
- **AND** the report states the source and target and contains no raw errors or
  connection details

#### Scenario: FCV guard rejects an unsafe transition

- **WHEN** the operator omits source/target, requests a non-sequential pair, or
  live binary, FCV or topology does not match the requested transition
- **THEN** the tool returns a sanitized failure and nonzero exit code
- **AND** it does not issue `setFeatureCompatibilityVersion`
