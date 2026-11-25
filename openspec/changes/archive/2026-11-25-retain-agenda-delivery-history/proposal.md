## Why

Terminal email jobs accumulate large rendered payloads in the Agenda queue. Legacy push jobs also remain after delivery. This increases MongoDB storage and the amount of delivery history copied with the database.

## What Changes

- Prune terminal `send email` and legacy `send push message` jobs after 90 days in bounded worker batches.
- Preserve active jobs and retain recent email history for admin delivery diagnostics.

## Capabilities

### Modified Capabilities

- `database-platform`: bound storage for terminal Agenda delivery jobs.

## Impact

The worker will build a MongoDB index on its first cleanup run and gradually remove eligible records created by current and older Agenda versions. The admin inventory continues to report logical BSON and allocated storage separately. Server integration tests cover the database behaviour.
