# Contributing to Trustroots

See https://team.trustroots.org/


## Tests and coverage

Run `npm run test:client` for the Jest client suite and `npm run test:server` for the Mocha/Supertest server suite. Jest runs with Watchman disabled so test discovery is consistent on developer machines and CI.

Run `npm run test:coverage` to generate client and server coverage reports. Generated reports live under `coverage/` and are ignored by git. `npm run coverage:check` compares the generated summaries against `coverage-baseline.json`; use `npm run coverage:update-baseline` after intentionally improving the baseline. `npm run coverage:report` writes the browser report shell plus `client.json`, `server.json`, and `e2e.json` under `coverage-report/`.

Codex-local coverage reporting is client-first: use `just coverage-report` to run client coverage, refresh only `coverage-report/client.json`, and open the report through a local browser URL. Server and end-to-end lanes appear as neutral skipped lanes unless they are explicitly refreshed, so stale blocked statuses do not make the local report look broken. Run `npm run test:e2e` when you intentionally want to record a fresh Playwright smoke-test result.

Jest treats the optional `canvas` package as absent so JSDOM uses its normal non-native canvas fallback. If non-test tooling fails while loading `canvas`, rebuild native dependencies for your current Node version with `npm rebuild canvas`. The project CI installs dependencies from scratch on Node 14, which avoids stale native binaries.

In Codex, use `npm run test:client` for client tests and `npm run test:server:codex` for server tests. The repo's `.codex/config.toml` enables the local network permission needed for MongoDB on `127.0.0.1` and localhost Playwright automation in trusted Codex sessions. The Codex server command ignores machine-specific `config/env/local.js`, uses an existing local MongoDB when reachable, and removes only the temporary Docker container it starts. By default it runs the full server suite in one pass; set `TRUSTROOTS_CODEX_ISOLATED_SERVER_TESTS=true` to rerun each server test file in its own process when debugging flakes.

To run selected server test files locally, use `npm run test:server:files -- modules/foo/tests/server/bar.tests.js`. Add further file paths separated by spaces. This uses the existing server test runner and its database configuration.

End-to-end tests build the client bundle once (`npm run build:e2e`) and serve pages from the API server. Set `TRUSTROOTS_E2E_USE_WEBPACK_DEV_SERVER=true` to use the webpack dev server instead (slower startup, closer to day-to-day frontend development).

Playwright runs one worker by default for local stability. Set `TRUSTROOTS_E2E_WORKERS=2` to opt into limited file-level parallelism, matching CI. Full multi-worker runs serialize Playwright projects by default to avoid shared seeded-state races; set `TRUSTROOTS_E2E_SERIAL_PROJECTS=false` only when deliberately checking project overlap. CI also sets `TRUSTROOTS_E2E_SKIP_JS_COVERAGE=true` because the smoke lane publishes Playwright results, not browser JavaScript coverage, and records Playwright video only on retries to keep green runs lighter.
