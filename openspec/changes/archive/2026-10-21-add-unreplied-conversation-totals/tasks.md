## Implementation

- [x] Add shared inbox selectors, unreplied filtering and opt-in totals.
- [x] Add responsive inbox controls, counts and refresh behaviour.
- [x] Add server, client and end-to-end regression coverage.
- [x] Run checks and coverage validation, update the living messaging spec and archive this change.

## Validation

- `pnpm check` passed, including lint, typechecking, 1,926 client tests and configuration tests.
- All 123 selected message server tests and all nine inbox browser checks passed on the current main branch.
- The changed message controller has 100% coverage across all metrics. No thresholds or baselines were changed.
- The production Vite build passed as part of the browser test run.
