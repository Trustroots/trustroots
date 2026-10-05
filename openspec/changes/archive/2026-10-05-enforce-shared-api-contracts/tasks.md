## Implementation

- [x] Define shared experience response contracts matching the existing payloads.
- [x] Check server staff-blocker and experience payload construction against the shared contracts.
- [x] Use shared contracts in client APIs and experience components.
- [x] Add blocking contract checking and negative compiler regressions.
- [x] Verify affected server/client tests, 100% coverage, type checks and lint without reducing browser coverage.
- [x] Archive the change and update the living specification.

## Verification evidence

- Client: 226 suites and 1,442 tests pass; statements, branches, functions and lines remain at 100% coverage.
- Repaired full server run: 1,979 tests pass with 22 existing pending; all four coverage metrics remain at 100%.
- The 23 affected experience and administration browser tests pass after the native ESM import repair.
- All three TypeScript configurations, changed-file lint and formatting pass. Compiler regressions exercise invalid shared contract construction without issuing HTTP requests.
- No end-to-end tests, coverage thresholds or baselines are removed or reduced.
