## Proposal

- [x] Validate the proposal with `openspec validate initialise-maps-with-geoip --strict`.

## Implementation

- [x] Pin the MMDB reader using pnpm and add optional server configuration and types.
- [x] Implement one reader per web process, safe address handling and coarse lookup results.
- [x] Add the authenticated, private/no-store endpoint and test request isolation.
- [x] Implement shared client lookup with account-change and late-response handling.
- [x] Add versioned, validated search viewport storage with 48-hour expiry and legacy migration.
- [x] Apply precedence consistently to vector/raster search and hosting/meeting editors.
- [x] Preserve explicit offer-location selection and the existing fallback.
- [x] Check module links; the existing graph is unchanged.
- [x] Document provisioning, database terms/attribution, updates, disabling and rollback.

## Verification

- [x] Add anonymous server and client regression cases described in the design.
- [x] Add e2e scenarios for fresh/recent/expired search, explicit destinations,
      lookup failure and explicit hosting/meeting selection; retain existing cases.
- [x] Run final `pnpm check`, server tests, full client/server coverage, affected
      browser projects and production build; retain 100% client/server coverage.
- [x] Document database memory measurements, proxy-chain checks, terms,
      attribution, provisioning and update requirements in `docs/geoip.md`.
- [x] Validate and archive the completed change and update living specifications.

## Operator activation (outside this implementation)

Production remains disabled until an operator supplies the licensed database
and completes the activation checklist in `docs/geoip.md`: measure cold-load,
lookup and aggregate Passenger memory with the intended database, verify real
client-address provenance through Nginx/Passenger, and provision/monitor updates.
These checks cannot be established using the synthetic test records and are
not claimed as completed by this change.
