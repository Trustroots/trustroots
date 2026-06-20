# Trustroots Code of Conduct

Refer to the [Ubuntu Code of Conduct](http://www.ubuntu.com/about/about-ubuntu/conduct) for guidance on how to contribute, particularly the following points:

- Be considerate
- Be respectful
- Take responsibility for our words and our actions
- Be collaborative
- Value decisiveness, clarity and consensus
- Ask for help when unsure
- Step down considerately

Our code of conduct might be described as follows.

- Be pragmatic.
- Be nice to people.
- Show respect for those who do the work.
- When in doubt, defer to those with more experience, who have contributed for longer, and support their decisions.
- [We believe](https://www.trustroots.org/about) in beauty, simplicity and transparency.
- We emphasize community.

## Not a discussion forum

GitHub issues are not a general discussion forum. This is a forum for technical discussion about how to implement features, questions of a technical nature, reporting bugs, and so on.

It is not a place for policy discussion. Personal opinion about which features are important, which features should or should not be implemented, and so on, does not belong here.

We operate a 3 strike policy. 1st warning, 2nd warning, blocked.

## Be pragmatic

We value getting things done attitude. Arguments about minor issues shouldn't get in the way of getting work done and achieving more important results. Use the tools and methods which help getting the job done. Let decisions be taken by people who do the work.

## Real life interaction

We highly value real life interaction. Both within the network as well as among technical contributors. If possible, try to meet up with other Trustroots contributors in real life. You can connect your Trustroots profile to your GitHub account to facilitate such connections.

## Tests and coverage

Run `npm run test:client` for the Jest client suite and `npm run test:server` for the Mocha/Supertest server suite. Jest runs with Watchman disabled so test discovery is consistent on developer machines and CI.

Run `npm run test:coverage` to generate client and server coverage reports. Generated reports live under `coverage/` and are ignored by git. `npm run coverage:check` compares the generated summaries against `coverage-baseline.json`; use `npm run coverage:update-baseline` after intentionally improving the baseline. `npm run coverage:report` writes the browser report shell plus `client.json`, `server.json`, and `e2e.json` under `coverage-report/`.

Codex-local coverage reporting is client-first: use `just coverage-report` to run client coverage, refresh only `coverage-report/client.json`, and open the report through a local browser URL. Server and end-to-end lanes appear as neutral skipped lanes unless they are explicitly refreshed, so stale blocked statuses do not make the local report look broken. Run `npm run test:e2e` when you intentionally want to record a fresh Playwright smoke-test result.

Jest treats the optional `canvas` package as absent so JSDOM uses its normal non-native canvas fallback. If non-test tooling fails while loading `canvas`, rebuild native dependencies for your current Node version with `npm rebuild canvas`. The project CI installs dependencies from scratch on Node 14, which avoids stale native binaries.

In Codex, use `npm run test:client` for client tests and `npm run test:server:codex` for server tests. The repo's `.codex/config.toml` enables the local network permission needed for MongoDB on `127.0.0.1` and localhost Playwright automation in trusted Codex sessions. The Codex server command ignores machine-specific `config/env/local.js`, uses an existing local MongoDB when reachable, and removes only the temporary Docker container it starts. By default it runs the full server suite in one pass; set `TRUSTROOTS_CODEX_ISOLATED_SERVER_TESTS=true` to rerun each server test file in its own process when debugging flakes.

For a single server test file locally, use `SERVER_TEST_FILES=modules/foo/tests/server/bar.tests.js npm run test:server`.

End-to-end tests build the client bundle once (`npm run build:e2e`) and serve pages from the API server. Set `TRUSTROOTS_E2E_USE_WEBPACK_DEV_SERVER=true` to use the webpack dev server instead (slower startup, closer to day-to-day frontend development).

Playwright runs one worker by default for local stability. Set `TRUSTROOTS_E2E_WORKERS=2` to opt into limited file-level parallelism, matching CI. Full multi-worker runs serialize Playwright projects by default to avoid shared seeded-state races; set `TRUSTROOTS_E2E_SERIAL_PROJECTS=false` only when deliberately checking project overlap. CI also sets `TRUSTROOTS_E2E_SKIP_JS_COVERAGE=true` because the smoke lane publishes Playwright results, not browser JavaScript coverage, and records Playwright video only on retries to keep green runs lighter.
