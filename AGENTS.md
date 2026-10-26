This is the canonical AI coding guideline file for this repository. Keep other
assistant-specific files, such as `.cursorrules` and `CLAUDE.md`, as short
pointers back to this file so the project guidance does not drift.

## Commands

This repository uses pnpm (the version is pinned in `packageManager`) and Node 24; npm is no longer supported. Run `pnpm install` after switching branches.

- `pnpm check`: lint, typecheck and client unit tests. Run it before every commit; it needs no database.
- `pnpm lint:boundaries` and `pnpm lint:boundaries:test`: check shared package production imports and run the guard regressions. These also run as part of `pnpm lint` and CI; affected checks run the guard before module tasks.
- `pnpm lint`, `pnpm typecheck`, `pnpm test:client`: the three parts of `pnpm check` on their own.
- `pnpm check:affected`: For changes confined to module workspace packages, Turborepo runs lint and client tests for affected modules and their dependents, then the repository-wide typecheck. Changes outside those packages (including `layers/shell`) or unavailable Git comparison fall back to full `pnpm check`. Compares committed, staged, unstaged and non-ignored untracked changes against the merge base with `origin/main` (override with `TURBO_SCM_BASE`). Each module is a workspace package, so `pnpm --filter @trustroots/<module> run lint` (also `test:client`, `test:server`) works on one module. After changing links between modules, run `pnpm modules:update-baseline` and `pnpm modules:update-packages`. CI still runs the full suite. Run `pnpm test:affected` for the affected-check runner's regression tests.
- `pnpm test:server`: the Vitest/Supertest suite. It needs MongoDB on localhost:27017. For selected files use `pnpm test:server:files modules/foo/tests/server/bar.tests.js`.
- `pnpm test:e2e`: the Playwright end-to-end suite.
- `pnpm test:coverage` and `pnpm coverage:check`: coverage runs and the comparison against `coverage-baseline.json`.
- `pnpm build`: the production client build.
- `pnpm reformat-files <files>`: run Prettier on the given files.

This project is under active development again (no longer in maintenance mode),
so improvements, refactors, and cleanups are welcome where they add value.

Shared production code in `packages/*` may import its own files, external dependencies,
and other shared packages declared with `workspace:*` in dependencies,
optionalDependencies or peerDependencies. It may not import application configuration,
modules, layers, apps or tooling. Integration test files are outside this source rule.

Avoid unnecessary re-exports. Import directly from the owning file and update
consumers when moving code. Keep a compatibility re-export only when a concrete
consumer or public API still needs the old path, and explain why it is needed.

Use tables for overviews when they make information easier to compare, with
coloured status dots where useful. Include text labels so meaning does not
depend on colour alone.

Use OpenSpec for new functionality, breaking behaviour changes, and material
architectural changes. Create and validate a proposal in `openspec/changes/`
before implementation, then archive it and update the relevant living specs in
`openspec/specs/` when the work is complete. Small bug fixes, formatting,
comments, configuration-only changes, and non-breaking dependency updates do
not require a proposal.

Keep test fixtures, regression cases, and example payloads anonymous. When
turning a public bug report or security disclosure (including a GitHub issue)
into a test, preserve only what is needed to reproduce the behaviour and
replace names, usernames, email addresses, locations, IDs, message content,
and other identifying data with fictional values.

Never publish security vulnerability details, Dependabot alert information, or
the security motivation for a change in public PRs, issues, comments, commit
messages, release notes, or other public-facing text. Keep that context private
and describe dependency updates neutrally in public.

Prefer git worktrees for parallel, exploratory, or potentially disruptive work.
Create them under `.worktrees/` inside this repository so they remain within
the workspace boundary.

When an independent operation needs a permission prompt, delegate that bounded
operation to a sub-agent when possible so the primary agent can continue useful
work. Do not use delegation to bypass a permission decision that must be made by
the user.

Both server and client test coverage are currently at 100%; keep them at this
level. Do not lower coverage thresholds or baselines without a clear reason.

Try not to reduce the number of end-to-end tests. The current baseline on main
is 167 e2e tests; if removing one, replace it with equivalent coverage unless
there is an explicit reason not to.

When adding new functionality, add at least one end-to-end test for it unless
there is a clear reason that e2e coverage is not appropriate.

Client unit tests may stay as `*.tests.js`; most of the suite still uses that
form. Prefer `*.tests.tsx` for new or heavily edited client tests when TypeScript
helps (typed fixtures, component props, stricter mocks), and `*.tests.ts` for
non-JSX unit tests. Do not rename large numbers of existing `.tests.js` files
only to change the extension. Jest already matches `.tests.[jt]s?(x)`, and
`tsconfig.tests.json` typechecks only `.ts` / `.tsx` client tests.

Use British spelling for any new text (for example decentralisation, organisation,
licence, emphasise). Do not change US spellings in code identifiers, CSS
properties, URLs, or third-party names.

Links between `modules/*` (imports and `mongoose.model('X')` lookups of another
module's models) are recorded in `module-graph-baseline.json`, and CI fails when
they differ from it. Do not add a link from one module to another without a
reason you can state in the PR. If one is intended, run
`pnpm run modules:update-baseline` and explain it in the PR; after removing one,
run the same command to lock in the improvement.

For how we work on GitHub (draft pull requests, rebasing instead of merging `main`, squash-merging, CI checks, keeping pull requests small, and keeping agent tooling out of the repo), see [GITHUB.md](GITHUB.md).

### Merging as an agent

When asked to merge a pull request onto `main`:

- **Always wait for required CI to pass.** Do not merge on red or while checks are still running. Do not use admin bypass, `bypass_rules`, or similar to skip CI or status checks.
- **Do not block on a human review** when the user wants the change on `main` without waiting for another reviewer. Bypassing the review requirement (or using an admin merge path that only skips review) is fine in that case.
- Prefer **squash-merge**, matching [GITHUB.md](GITHUB.md).
- If CI fails after a push meant for merge, fix it (or say why the failure is unrelated) and only merge once green again.
