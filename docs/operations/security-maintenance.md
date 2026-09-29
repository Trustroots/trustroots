# Security maintenance ownership and drills

This runbook defines work for the deployment owner. This PR does not rotate a live secret, access a production backup or execute a restore. Record the responsible person and review date in the deployment inventory.

## Secret rotation

Inventory session-signing, database, SMTP, webhook and logging credentials. For each, record its owner, storage location, consumers, rotation mechanism and revocation procedure without putting values in the repository. Prepare replacement credentials, verify consumers in staging, switch the deployment, confirm operation, and revoke the old credential. Session-signing changes can invalidate sessions; document that user-facing effect. Use overlapping credentials only where the integration explicitly supports them.

## Backup access and restore drill

Restrict backup access to named operators, encrypt storage and transport, and record retention and deletion policies. Restore into an isolated environment with outbound email/jobs disabled and public access blocked. Verify schema, representative anonymous functional checks and recovery objectives. Destroy the isolated restore securely after the drill and record results without copying private data into logs or issue reports.

## Incident diagnostics

Keep timestamps, event types, aggregate counts and error classifications. Exclude passwords, tokens, private message content and unnecessary personal identifiers. Restrict log and export access, define retention, and review administrative exports for their intended audience. The [application logging guide](../Logging.md) describes the logger's metadata redaction and its limits; it cannot infer sensitive data in every free-text string.

Dependency update and CI secret-handling ownership are covered by the separate CI hardening PR.
