# Design

## Driver consolidation

The application's supported client graph must be understood per integration,
not inferred from one top-level lockfile entry. Mongoose 9.11.4 uses the
MongoDB Node.js driver 7.x line; the root currently pins `mongodb` 6.20.0.
Agenda 4.4.0 brings `mongodb` 4.17.2, Agendash 4.0.0 directly uses driver 6.20
and Agenda 4 APIs, and connect-mongo 6.0.0 is passed the Mongoose connection.
These constraints make a blind root bump or override unsafe.

Published metadata identifies a supported Agenda path: `@agendajs/mongo-backend`
4.0.3 peers with Agenda 6.2.6 and `mongodb` `^6.0.0 || ^7.0.0`; Agendash 8.2.4
peers with Agenda 6.2.6. Migrate the old Agenda 4 `{ address, collection }`
configuration to `MongoBackend`, while retaining `agendaJobs`. Update dashboard
integration and account for Agenda 6 API changes, including `jobs` →
`queryJobs`, event/type changes and stop/close lifecycle. Verify the exact
connect-mongo peer range and its use of the supplied Mongoose connection. Do not
force an incompatible peer with `pnpm.overrides` or claim consolidation solely
because `pnpm why mongodb` reports one root package.

The worker's direct raw-driver collection access (`agendaJobs`) and dashboard
must be tested as well as Mongoose model operations. Preserve coverage for
repeat upsert, `nextRunAt` preservation, production-shaped recurring jobs,
restart, immediate enqueue and worker unlock behaviour. connect-mongo must
continue receiving the existing Mongoose connection; it must not silently
create a second client/pool. Record the final `pnpm why mongodb` tree and
peer-resolution output as implementation evidence.

## Server upgrade and rollback boundary

MongoDB 7 can only be reached from 6.0, and earlier releases must be crossed in
order. If preflight confirms a 4.4 source, the planned sequence is 4.4 → 5.0 →
6.0 → 7.0. At each hop, upgrade server binaries using the deployment's supported
standalone, replica-set, sharded-cluster or managed-service procedure; validate
the deployment while it remains at the previous FCV; then raise FCV only after
the agreed burn-in gate. Record the exact FCV command and result appropriate to
the server version and topology. MongoDB 7 requires `confirm: true` when setting
FCV; do not copy the 7.0 command into earlier steps without checking that
version's manual.

Raising FCV enables features that may persist data unreadable by the prior
release. Before that point, rollback may use the previous binaries only when
MongoDB's version-specific downgrade rules allow it and FCV remains compatible.
After FCV advances, rollback must follow the documented downgrade procedure and
must not assume that restoring the old application image is sufficient. Preserve
an immutable application image and separately prepared database recovery plan.

Retain CI coverage for both MongoDB 4.4 and 7.0 during this transition. Select
the latest patch release in each major series used for a rehearsal or migration,
and verify that the deployment's operating system and CPU meet that release's
requirements, including AVX-capable x86_64 CPUs for MongoDB 5.0 and later.

## Recovery rehearsal

Take both the platform's native consistent backup/snapshot (where available)
and a logical dump with matching database tools. Quiesce application and worker
writes, pause scheduling and processing of jobs, or use a documented backup
method that provides consistency across application data and `agendaJobs`; a
logical dump taken during ongoing writes must not be assumed to be a point-in-time
recovery image. Verify artifact checksums,
retention, encryption/access controls, completion status and restore logs.
Restore into an isolated environment using the documented namespace mapping,
including `agendaJobs` and `agendaJobsArchived` where present. Existing local
fetch/import helpers omit or exclude `agendaJobs`; update or bypass them for the
rehearsal and record the exact method. Validate document/collection counts and
indexes, connect the application and worker, and inspect queued/running/repeating
jobs without sending real email or causing other external side effects. A dump
without job collections is not a complete recovery rehearsal.
