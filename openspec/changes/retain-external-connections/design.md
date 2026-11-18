## Storage and consistency

Keep history, normalised search keys and an initialisation marker on the User document, excluded from selection by default. Entries contain network, oldIdentifier, newIdentifier, changedAt (null for initial snapshots), and initial. Store public identifiers only. Use a conditional save against persisted connection state so current values, history and search keys change atomically and conflicting writes fail rather than overwrite. Initialise existing connections before recording their first change. Backfill uses the same conditional initialisation and retries conflicts without duplicating entries.

## Staff interfaces

GET /api/admin/network-connections/:memberId returns current connections and a newest-first page of history. GET /api/admin/network-connections requires network and identifier, accepts recognised profile URLs, and returns deduplicated matching members labelled current or previous. Both accept page, use 50 items per page, and return hasNextPage. Both are restricted to admin/support-team and audited. A shared panel and /admin/network-connections search page use these endpoints. History and indexes never enter public or own-profile responses.

## Deployment

Deploy tracking before backfill. Run a bounded-memory idempotent maintenance command to initialise existing records, then verify search index availability. Keep initial dates unknown; do not infer earlier changes. Account deletion removes embedded history. No historical identifier is unique across accounts.
