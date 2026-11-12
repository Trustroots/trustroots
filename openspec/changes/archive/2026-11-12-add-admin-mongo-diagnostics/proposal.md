## Why

Administrators need to identify what is taking up Agenda storage and record the live MongoDB version and feature compatibility version before planning each step of the 4.4 to 7.0 migration.

## What Changes

- Add an administrator-only MongoDB dashboard with on-demand, read-only deployment and Agenda storage diagnostics.
- Show the connected server version, feature compatibility version (FCV), topology and their relationship to the sequential upgrade path.
- Link to the rollout issue and runbook for backup restoration, rehearsals and acceptance evidence.
- Show timestamped live and archived collection storage and live job counts without returning job payloads.

## Capabilities

### Modified Capabilities

- `admin-moderation`: Inspect MongoDB migration context and Agenda storage.

## Impact

The admin module adds a route, navigation link and API. The dashboard uses the existing MongoDB connection and makes no data or deployment changes. Missing privileges or unavailable readings are reported independently.
