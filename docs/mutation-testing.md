# Mutation testing

Line coverage says which code the tests run, not whether they would notice it
breaking. [Stryker](https://stryker-mutator.io/) makes small changes to the
source (a `>` becomes `>=`, a condition becomes `true`, a string becomes empty)
and reruns the tests. A mutant is killed when a test fails, and survives when
every test still passes. The mutation score is the share of mutants the tests
detect (killed or timed out) out of all mutants that ran.

Mutation testing runs alongside the coverage gates, not instead of them: CI
still requires 100% client and server coverage. Coverage says every path is
run; the mutation score says the tests would notice it change. Only the server
suite is mutation-tested in CI.

## What CI mutates

The `Mutation` workflow (`.github/workflows/mutation.yml`) asks
`scripts/mutation/server-scope.cts` which server source a pull request can
affect:

- a changed server source file is mutated itself;
- a changed, added or deleted server test (anything under
  `modules/<name>/tests/server/`) mutates every server source file of
  `<name>`, plus the server source in other modules or packages that the test
  imports directly, in its old or new version. Deleting or weakening a test
  therefore re-runs the mutants it used to kill, even when no source changed;
- a change to shared test infrastructure (`testutils/server/`, the Vitest and
  Stryker server configs, `scripts/mutation/`, `tooling/stryker/`, the floors)
  mutates the whole server.

Each module is a shard, run in parallel and checked against its own floor in
`tooling/baselines/mutation.json` (`server.shards`, falling back to
`server.default`). A module with more than four source files is split into
shards of four (`users-1`, `users-2`, …) that share its floor: a CI job has a
time limit, and Stryker only saves its results when a run finishes. Shards reuse the incremental results cached by the last run,
so only mutants whose code or covering tests changed are re-tested.

The mapping can miss a test that reaches another module only over HTTP. The
weekly run (and any manual run of the workflow) mutates the whole server, which
catches those and refreshes the caches.

Run `node scripts/mutation/server-scope.cts --base=origin/main` to see what CI
would mutate for your branch.

## Running it

The server needs MongoDB, as for `pnpm run test:server`.

```sh
# One or more files (comma separated)
pnpm run test:mutation:server --mutate modules/offers/server/controllers/offers.server.controller.mts
# Compare the report with the floor
pnpm run mutation:check --scope=server
```

Without `--mutate`, `pnpm run test:mutation:server` mutates the whole server.
That takes several hours; use `--concurrency` to match the free cores. Runs are
incremental (`reports/stryker/server-incremental.json`), so a re-run only tests
mutants whose source or covering tests changed. The HTML report is written to
`reports/stryker/server.html`.

`pnpm run test:mutation:client` and `pnpm run test:mutation:nostranslation`
configure the client and Nostranslation Jest suites. They have no floor yet.

## Configuration

- `stryker.server.config.mjs` uses the Vitest runner with per-test coverage, so
  each mutant runs only the tests that reach it. Bail stays on: a mutant stops
  at its first failing test.
- `vitest.stryker.server.config.mts` runs `*.unit.tests.*` files first, so a
  mutant is credited to a focused unit test when one catches it, gives each
  Stryker worker its own database and sets a 3 second test timeout.
- Models, the push-message and welcome-sequence jobs and
  `file-removal.server.service.mts` are not mutated. The last one guards an
  `rm -rf`, and with the guard mutated away its test deletes the Stryker
  sandbox.
- The TypeScript contract tests (`*.server.types.tests.cts`) and the native
  coverage test check the source rather than its behaviour, so mutation runs
  leave them out.

## When the gate fails

Open the HTML report from the CI artifact (`mutation-report-<shard>`) and look
at the surviving mutants. Each one is a change to the code that no test
noticed. Add or tighten an assertion so a test fails for it.

If a mutant cannot change behaviour (an equivalent mutant), disable it where
it is, for that mutator only, with the reason:

```js
// Stryker disable next-line StringLiteral: the label is only logged
logger.info('cleanup finished');
```

Never disable a whole file or every mutator on a line to make the score.
Raise a floor when the measured score goes up; lower it only with a reason.
