# Mutation testing

Line coverage says which code the tests run, not whether they would notice it
breaking. [Stryker](https://stryker-mutator.io/) makes small changes to the
source (a `>` becomes `>=`, a condition becomes `true`, a string becomes empty)
and reruns the tests. A mutant is killed when a test fails, and survives when
every test still passes. The mutation score is the share of mutants the tests
detect (killed or timed out) out of all mutants that ran.

The server suite is the gate. Pull requests run Stryker on the server source
files they add or change, and CI fails if the score for those files is below
the floor in `tooling/baselines/mutation.json`. Coverage is still collected and
reported, but it no longer fails a run.

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

Open the HTML report from the CI artifact (`mutation-report`) and look at the
surviving mutants in your files. Each one is a change to your code that no
test noticed. Add or tighten an assertion so a test fails for it. If a mutant
cannot change behaviour (an equivalent mutant), say so in the pull request.
Raise the floor when the measured score goes up; lower it only with a reason.
