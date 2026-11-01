## Design

Keep one JSON file per UUID in `.trustroots-deployment-events` beside Compose,
under the helper's existing exclusive lock. Write and fsync a temporary file,
atomically replace the destination and fsync the directory. Persist the intended
images before replacement so a process interruption retains the event identity.

The readiness timestamp describes verification, not the commit timestamp or
SMTP delivery. Explicit rollback is a new event. Failed deployment attempts
are marked failed and cannot be completed through recovery. Automatic
restoration emits no success. Interrupted attempts remain pending.

Recovery takes an existing event UUID, checks the saved origin and running image
IDs, and repeats readiness. Completed events are immutable and recovery is a
no-op. The existing lock serialises cooperating invocations on one deployment
host; this is not a distributed database ledger or email deduplication mechanism.
No application startup or worker process reads or creates receipts.

A receipt write failure after readiness prints a controlled warning and leaves
the healthy deployment in place. An initial journal write failure stops before
replacement. Downstream notification processing must add explicit production
gates, shared durable claims and per-recipient queue progress before sending.
