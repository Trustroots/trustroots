## Why

A remote telemetry outage stalled login and Docker container replacement. A missing media mount hid photos, and proxy session settings prevented persistent login. Deployments need explicit checks and an immutable rollback reference.

## What Changes

- Complete application statistics callbacks after local validation, without waiting for remote delivery; retain a delivery-aware API for statistics jobs.
- Bound InfluxDB requests and concurrent statistics delivery.
- Explicitly use rotated local container logging.
- Load Umami asynchronously and allow disabling it, so an unavailable analytics host cannot hold up document readiness.
- Add an operator deployment command that checks storage, configuration and database access, saves previous image IDs, checks readiness and a real login session, and rolls back on failed verification.
- Document a systemd mount dependency and production HTTPS configuration.

## Impact

Statistics are best effort and may be dropped during outages; background jobs retain delivery error reporting. Production operators must adopt the new script and local logging configuration in their deployment-owned Compose file. No database migration. Credentials are prompted or supplied via environment variables, never written into rollback state.
