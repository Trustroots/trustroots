## ADDED Requirements

### Requirement: MongoDB 7 platform compatibility

Trustroots SHALL declare MongoDB 7.0 as its production server target only when
the application, worker, session store, background-job integration and
operational dashboard have been verified against the resolved MongoDB driver
dependency graph. The graph SHALL honour each package's declared peer contract
and SHALL NOT use overrides to force an unsupported driver combination.

#### Scenario: Application stack connects to MongoDB 7

- **WHEN** the application and worker run against the supported MongoDB 7.0
  deployment with the validated dependency graph
- **THEN** Mongoose operations, session persistence, Agenda job reads/writes and
  dashboard access use compatible clients and preserve existing document
  behaviour

### Requirement: Sequential MongoDB major-version upgrade

If preflight confirms MongoDB 4.4 as the source, the upgrade to 7.0 SHALL
proceed through 5.0 and 6.0 in order. CI SHALL continue to exercise MongoDB
4.4 and 7.0 during the transition. At every major-version boundary, the
deployment SHALL satisfy the target version's binary and FCV prerequisites,
complete a documented burn-in and
acceptance gate, and retain recorded evidence before advancing to the next
major version.

#### Scenario: Operator advances one major version

- **WHEN** an operator is preparing to upgrade from one major release to the
  next
- **THEN** the current binary version, FCV, health, backup identifier and
  acceptance evidence are recorded
- **AND** the version-specific MongoDB upgrade procedure and FCV command are
  followed
- **AND** the next upgrade is not started while the current gate has failed

### Requirement: Complete database recovery rehearsal

Before production migration, operators SHALL restore a verified backup into an
isolated environment and validate application data, indexes, sessions and
background jobs. The recovery rehearsal SHALL include the `agendaJobs`
collection, which the existing local fetch helper excludes. The backup SHALL
represent a consistent recovery point across application writes and job state,
using write quiescence or a documented consistent snapshot/dump method.

#### Scenario: Restore rehearsal validates queued jobs

- **WHEN** a database backup is restored into the isolated rehearsal environment
- **THEN** the record includes source backup identity, checksums, restore tools,
  namespace mapping, collection and index validation, and application/worker
  smoke results
- **AND** both active and archived Agenda job collections are included when
  present
- **AND** no real external job side effects are triggered
