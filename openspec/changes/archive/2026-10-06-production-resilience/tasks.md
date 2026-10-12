## Implementation

- [x] Decouple request statistics from remote delivery and bound delivery resources.
- [x] Add outage regression coverage without lowering coverage baselines.
- [x] Use explicit local logging and document HTTPS proxy and mount dependencies.
- [x] Add deployment preflight, session verification and image-ID rollback.
- [x] Validate the proposal, exercise regression checks, archive the change and update living specifications.

## Verification evidence

- Full server suite: 2,079 passing, 22 existing pending, 100% statement/function/branch/line coverage.
- Core route suite after adding analytics checks: 51 passing.
- Browser signin regressions: four passing with an unreachable statistics backend and stalled/failed analytics loading.
- Deployment safeguard tests: 11 passing; external Docker/HTTP operations are mocked.
- ESLint, formatting and OpenSpec strict validation passed.
- Deployment host adoption is documented; no production deployment was performed.
