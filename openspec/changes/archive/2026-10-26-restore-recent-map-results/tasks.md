## Implementation

- [x] Add a session- and backend-scoped map snapshot cache shared by Search tab visits.
- [x] Hydrate viewport, filters and offers immediately, then refresh stale snapshots.
- [x] Cover new Search visits, freshness expiry, session/backend boundaries, explicit Retry and changed bounds.
- [x] Update the native Android member app living specification.

## Validation

- [x] Validate the OpenSpec change.
- [x] Run Android unit tests, lint and focused API36 Search journeys.
- [x] Run `pnpm check`.
