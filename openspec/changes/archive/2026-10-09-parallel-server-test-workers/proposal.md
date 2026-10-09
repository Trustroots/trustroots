## Why

Server integration tests repeatedly perform production-cost password hashing and run serially. Running the existing test files in independent processes can reduce elapsed time, but sharing the current test database would let one worker delete another worker's fixtures.

## What Changes

- Add an opt-in parallel server-test command with a bounded worker count and deterministic file partitioning.
- Give every worker a unique test-only database for that invocation, including Agenda jobs, and clean it up after execution.
- Preserve the existing serial command, test selection, failure reporting and coverage collection.
- Document CPU/memory costs and retain real authentication and password checks.

## Impact

- Affected spec: runtime-platform.
- Affected code: server-test orchestration and test-only database configuration.
- No application behaviour or production configuration changes. No browser e2e test is appropriate for a command-line test runner; add orchestration unit tests and run database-backed checks instead.
