## Proposal

- [x] Validate the proposal with `openspec validate initialise-maps-with-geoip --strict`.

## Implementation

- [ ] Pin the MMDB reader using pnpm and add optional server configuration and types.
- [ ] Implement one reader per web process, safe address handling and coarse lookup results.
- [ ] Add the authenticated, private/no-store endpoint and test request isolation.
- [ ] Implement shared client lookup with account-change and late-response handling.
- [ ] Add versioned, validated search viewport storage with 48-hour expiry and legacy migration.
- [ ] Apply precedence consistently to vector/raster search and hosting/meeting editors.
- [ ] Preserve explicit offer-location selection and the existing fallback.
- [ ] Check module links; justify and record any intentional additions.
- [ ] Document provisioning, database terms/attribution, updates, disabling and rollback.

## Verification and Activation

- [ ] Add anonymous server and client regression cases described in the design.
- [ ] Add e2e scenarios for fresh/recent/expired search, explicit destinations,
      lookup failure and explicit hosting/meeting selection; retain existing cases.
- [ ] Run `pnpm check`, server tests, full client/server coverage, browser tests
      and production build; retain 100% client/server coverage.
- [ ] Record cold-load, lookup and memory measurements with the intended database
      and Passenger concurrency, including process replacement overhead.
- [ ] Verify client-address provenance and forged-header behaviour through Nginx/Passenger.
- [ ] Provision the updater/database and confirm terms, attribution and resource
      capacity before enabling the configured database path.
- [ ] Validate and archive the completed change and update living specifications.
