## Implementation

- [x] Validate this proposal before implementation.
- [x] Add three isolated groups and CI aggregation with failure artefacts.
- [x] Remove unnecessary navigation and browser fixtures from API checks.
- [x] Consolidate password coverage and exercise visible browser validation.

## Validation

- [x] Verify disjoint group membership and group-local dependencies.
- [x] Test successful, failed, missing and malformed aggregate reports.
- [x] Run affected server tests and browser journeys; compare timing and retries.
- [x] Preserve complete feature coverage and 100% client/server thresholds.
- [x] Archive and update living specs after successful validation.

## Results

- 302 retained product/browser cases passed across the three groups (308 checks
  including repeated authentication setup), with no failures, skips or retries.
- Aggregate coverage: 104/104 features and 326/326 required scenarios.
- 39 group/reporting unit checks and 18 password route checks passed.
- Lint, YAML parsing, shell syntax and strict proposal validation passed.
- Client/server application source, coverage thresholds and baselines were not
  changed by this work.
- Local baseline: 467.87 seconds. Group runs: account/public 111 seconds,
  community 34 seconds, admin/search 154 seconds. The groups ran sequentially
  and the baseline shared the machine for part of the comparison. These timings
  include startup and seeding but exclude the shared asset build; CI pipeline
  timings must be confirmed after the workflow runs.
