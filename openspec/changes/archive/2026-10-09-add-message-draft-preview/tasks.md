## Implementation

- [x] Validate the proposal before implementation.
- [x] Add authenticated draft formatting and server tests proving no message side effects.
- [x] Add preview API client, shared message rendering and accessible composer toggle.
- [x] Cover drafts, focus, loading, retry, stale requests, links and send outcomes in client tests.
- [x] Add desktop and mobile end-to-end coverage without removing existing tests.
- [x] Run lint, typechecking, tests and coverage checks without lowering thresholds.
- [x] Update the messaging living spec and archive the change when complete.

Validation: lint and all three TypeScript checks passed. The PR branch passed 1,605 client tests at 100% coverage; the full server run plus 167 successful isolated retries achieved 100% server coverage. Both desktop and mobile preview end-to-end tests passed. No coverage thresholds or end-to-end tests were removed.
