# MongoDB 7 migration runbook

## Status and scope

This is a planning and rehearsal runbook. No production database has been
changed by preparing it. Production execution requires a separately approved
change window and an operator with access to the actual deployment and provider
controls. MongoDB 8 or later is out of scope. The requested MongoDB 7.0 target
is supported through 31 August 2027; plan the next upgrade before that date.

If preflight confirms MongoDB 4.4 as the source, the sequence is **4.4 → 5.0 →
6.0 → 7.0**. The production source version and topology have not been inspected
here. Never skip a major release. Use the official procedure matching the real
topology and hosting model; this document is not a substitute for a managed provider's
workflow or the standalone, replica-set or sharded-cluster procedure.

## Required change record

Create one record per environment and migration window. Copy the record for each
major-version hop; do not fill it retrospectively.

| Evidence                   | Value to record                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Change/ticket and approval | Change ID, approver, operator, reviewers                                                                                                                      |
| Environment and topology   | Environment, provider, standalone/replica set/sharded, region, cluster identifier (no credentials)                                                            |
| Window                     | Planned and actual start/end in UTC; pause/abort decision and time                                                                                            |
| Starting state             | MongoDB binary version on every member/node, FCV, topology/replica health, member state, replication lag, disk capacity                                       |
| Target state               | Target binary version, intended FCV, selected official/provider procedure and version-specific command references                                             |
| Application state          | Immutable application image/revision, Node version, resolved package lock revision, driver tree (`pnpm why mongodb`), CI and staging acceptance links         |
| Recovery point             | Native snapshot ID/time/status, logical dump path/ID/time, tool versions, SHA-256 checksums, retention and encryption/access verification                     |
| Consistency method         | Write-quiescence window or documented consistent snapshot/dump method covering application and job state                                                      |
| Restore rehearsal          | Isolated target and version, commands/procedure, namespaces, collection/index validation output, including `agendaJobs` and `agendaJobsArchived` when present |
| Per-hop gate               | Health checks, application/worker/session/job/dashboard smoke results, error and latency baseline/after, queue counts, decision and sign-off                  |
| Final state                | Binary version on every node, FCV output, validation links, outstanding issues, rollback/recovery disposition                                                 |

Do not put secrets, connection strings, credentials, personal data or raw job
payloads in the record. Link to access-controlled evidence instead.

## Before the first hop

1. Confirm the actual source version, latest patch level, topology and hosting
   model with the service owner. Use the
   matching MongoDB/provider procedure. Confirm all nodes are healthy and have
   sufficient disk, backup retention and capacity for the upgrade. Verify each
   selected series' operating-system and CPU requirements; MongoDB 5.0 and later
   require AVX-capable x86_64 CPUs.
2. Review the MongoDB 5.0, 6.0 and 7.0 compatibility changes and application
   driver support. Verify the staged deployment and the exact production
   application image against MongoDB 7.0, including app, worker, session store,
   Agenda and Agendash. Record package peer compatibility and the resolved
   `mongodb` dependency tree; do not override an incompatible package peer.
3. Establish baseline request/error/latency metrics, worker health, counts of
   queued, locked and failed Agenda jobs, and the state of all replica-set or
   sharded-cluster members where applicable.
4. Coordinate a write-quiescence window covering application writes and Agenda
   job creation/claiming/processing, or use the provider's documented consistent
   snapshot method. Pause job scheduling and workers where applicable. Create a
   provider-native consistent snapshot where available and a logical dump with
   supported Database Tools. A dump during ongoing writes is not assumed to be
   a point-in-time image across application collections and job state. Verify
   both completed successfully and record IDs, timestamps, tool versions,
   checksums, encryption and retention.
5. Restore the backup to an isolated environment and verify collections,
   indexes, representative document counts, application startup, session
   persistence and job visibility. Include `agendaJobs` and
   `agendaJobsArchived` if present. `deploy/docker/fetchMongoDumps.sh` explicitly
   excludes `agendaJobs`, and `deploy/docker/importMongoData.sh` excludes it in
   its directory restore path; those helpers alone do not produce or validate
   a complete application recovery point. Do not execute restored jobs against
   real email, external APIs or other live services.
6. Write down the exact commands/provider steps and abort thresholds before the
   window. Ensure the operator can halt before changing FCV and has verified
   recovery credentials and a tested restore path.

## Per-major-version procedure

Repeat this section for **4.4 → 5.0**, **5.0 → 6.0**, and **6.0 → 7.0**. For a
given hop, the source FCV must be the current major release before proceeding to
the next release. Check and record it with the version-appropriate admin
command, for example:

```javascript
db.adminCommand({ getParameter: 1, featureCompatibilityVersion: 1 });
```

1. **Preflight and freeze:** confirm the source binary/FCV, topology health,
   backup and successful restore rehearsal, application compatibility, and
   change approval. Pause unrelated schema/index operations and deployments.
2. **Upgrade binaries:** follow the official procedure for the actual topology
   and provider. For replica sets, use the documented rolling sequence; for
   sharded clusters, follow the sharded sequence. Do not substitute a standalone
   procedure. Keep FCV at the previous release during burn-in.
3. **Stabilise:** verify all nodes report the target binary release and expected
   healthy states; verify replication/cluster health, disk, logs, query errors,
   application latency and worker queue processing. Exercise login/session
   persistence, representative Mongoose reads and writes, a harmless Agenda
   test job, and dashboard access. Compare metrics with the baseline.
4. **Hold at previous FCV:** burn in for the duration approved in the change
   record. Monitor errors, latency, failovers, replication lag, queue growth and
   job failures. If the gate fails, stop progression and use the version-specific
   rollback/recovery procedure while FCV remains at the old value where
   supported. Do not assume that old application binaries alone reverse a
   database binary upgrade.
5. **Advance FCV:** only after sign-off, use the command documented for that
   exact server release and topology. On MongoDB 7.0 the command requires
   `confirm: true`, for example on the `admin` database:

   ```javascript
   db.adminCommand({
     setFeatureCompatibilityVersion: '7.0',
     confirm: true,
   });
   ```

   Do not use this 7.0 syntax as a copy/paste command for 5.0 or 6.0. Confirm
   command success and read back the FCV. The MongoDB 7 FCV change is a material
   downgrade boundary; treat rollback after it as a documented database
   downgrade or restore, not a simple binary swap.

6. **Close the hop:** attach command output (with secrets removed), record every
   evidence field, capture approvals and outcome, then explicitly approve the
   next major hop. Do not chain hops in one unattended operation.

## Acceptance gates

Every hop must pass all applicable checks before the next begins:

- Each node reports the expected binary version; FCV is the intended value.
- Topology is healthy; no unexpected recovery/rollback state, sustained lag,
  disk pressure or unplanned election/failover remains.
- The application and worker stay connected; authentication and session
  persistence work; representative reads/writes preserve current data shape.
- Agenda can read and claim the harmless rehearsal job; counts of locked,
  failed and queued jobs are understood and no unexplained queue growth remains.
- Agendash connects and reads the configured collection without creating a
  separate unsupported client path.
- Error rate, database latency and job failure rate remain within the
  pre-approved thresholds recorded with the change.
- Backup artifacts remain available and verified; the isolated restore
  rehearsal included job collections, with no live external side effects.
- The operator, reviewer and change approver record pass/fail and the next-step
  decision for the current hop.

The existing pull-request CI exercises MongoDB 4.4 and 7.0 (PR #3463, merged at
`e76d53a`). Keep both server lines in CI during the migration so compatibility
with the confirmed current baseline and target remains visible.

## Abort and recovery

Abort before advancing FCV if any health or acceptance gate fails. Follow the
MongoDB release-specific downgrade rules for the exact deployment type; major
version downgrades are constrained, and MongoDB 7 Community does not support
binary downgrades. If a supported downgrade is unavailable or data/FCV state is
uncertain, stop writes as required by the approved incident plan and restore the
verified recovery point to a compatible deployment. Reconcile writes and
background jobs deliberately before reconnecting production traffic. The
previous application image is useful for application rollback, but does not
reverse an incompatible database data format or restore omitted job records.

## Official references

- [MongoDB versions and upgrade paths](https://www.mongodb.com/docs/mongodb-versions/)
- [MongoDB 5.0 release notes and upgrade prerequisites](https://www.mongodb.com/docs/v5.0/release-notes/5.0/)
- [MongoDB 6.0 release notes and upgrade prerequisites](https://www.mongodb.com/docs/v6.0/release-notes/6.0/)
- [MongoDB 7.0 release notes and upgrade prerequisites](https://www.mongodb.com/docs/v7.0/release-notes/7.0/)
- [MongoDB 5.0 production notes, including CPU requirements](https://www.mongodb.com/docs/v5.0/administration/production-notes/)
- [Upgrade a standalone to MongoDB 7.0](https://www.mongodb.com/docs/v7.0/release-notes/7.0-upgrade-standalone/)
- [Upgrade a replica set to MongoDB 7.0](https://www.mongodb.com/docs/v7.0/release-notes/7.0-upgrade-replica-set/)
- [MongoDB 7.0 `setFeatureCompatibilityVersion`](https://www.mongodb.com/docs/v7.0/reference/command/setfeaturecompatibilityversion/)
- [MongoDB Database Tools `mongodump`](https://www.mongodb.com/docs/database-tools/mongodump/)
- [MongoDB Database Tools `mongorestore`](https://www.mongodb.com/docs/database-tools/mongorestore/)
