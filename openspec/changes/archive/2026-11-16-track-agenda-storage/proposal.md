## Why

A live storage reading cannot establish whether Agenda is growing or which jobs account for its footprint.

## What Changes

- Collect daily aggregate storage readings for the two Agenda collections and show the last 30 UTC days on the administrator dashboard.
- Extend the job inventory with total documents, uncompressed BSON size and the oldest completed run by job name.
- Use the existing Agenda worker. Deploying starts collection without a migration or historical backfill. Captures contain collection statistics only.

## Capabilities

### Modified Capabilities

- `admin-moderation`: Add storage history and extend the Agenda job inventory.

## Impact

The admin module owns the diagnostics. The worker writes to a dedicated MongoDB collection. The inventory remains administrator-only and bounded by a query time limit.
