## ADDED Requirements

### Requirement: Restore recent map results on a new Search visit

The authenticated Android shell SHALL retain the latest successful map viewport,
visible bounds, filters and offers in memory for a short freshness period.
Opening a new Search visit for the same backend and member session SHALL display
that snapshot immediately. If the snapshot is stale, Search SHALL refresh its
current bounds in the background while keeping the cached offers visible until
a successful response replaces them. A changed viewport SHALL search its new
bounds, and explicit Retry SHALL issue a request regardless of cache freshness.
Snapshots SHALL NOT be shown across a backend or member-session change.

#### Scenario: Return to Search with recent results

- **WHEN** a member leaves Search and opens a new Search tab visit before the
  snapshot expires
- **THEN** the previous map viewport and offers appear immediately
- **AND** no duplicate offer request is made while that snapshot is fresh

#### Scenario: Refresh an expired snapshot while keeping it visible

- **WHEN** a member opens Search with an expired snapshot
- **THEN** the cached viewport and offers are shown immediately
- **AND** a search for the current bounds refreshes them in the background

#### Scenario: Keep snapshots within their backend and session

- **WHEN** the backend, member or session cookie changes
- **THEN** the previous map snapshot is cleared before the next Search visit

#### Scenario: Refresh after an explicit retry or bounds change

- **WHEN** a member retries a failed search or pans the map to new bounds
- **THEN** Search requests those bounds even when a cached snapshot exists
