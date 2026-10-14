# Working on GitHub

How we work with branches and pull requests in this repository. For setup and tests see [CONTRIBUTING.md](CONTRIBUTING.md); for the guidelines coding assistants follow see [AGENTS.md](AGENTS.md).

## Pull request flow

1. Branch from `main` and push your branch.
2. Open the pull request as a **draft**. Fill in the template (`.github/PULL_REQUEST_TEMPLATE.md`): proposed changes, testing instructions, and `Fixes #` for the issue it closes.
3. Check it yourself while it is a draft: read the diff on GitHub, wait for CI, and try the change.
4. When it looks right, mark it **ready for review** and request a reviewer.
5. Once approved and green, **squash-merge** it.

## Keeping a branch up to date

Update a pull request branch by rebasing it onto `main` and pushing with `--force-with-lease`:

```sh
git fetch origin
git rebase origin/main
git push --force-with-lease origin <branch>
```

Do not merge `main` into a pull request branch (including the "Update branch" merge button). Merges of `main` have thrown away changes before. `--force-with-lease` refuses to overwrite commits you have not seen, so use it instead of a plain `--force`.

## CI checks

Pull requests targeting `main` run the workflows in `.github/workflows/`:

- **Linter** (`lint.yml`): one ESLint scan, reused for reviewdog annotations and lint enforcement, the API input boundary tests, and the module-graph check. Links between `modules/*` are recorded in `module-graph-baseline.json` and CI fails when they differ; see [AGENTS.md](AGENTS.md) for when to update the baseline.
- **Tests** (`test.yml`): production and dev Docker image builds, client checks directly on Node 24, server tests, and the end-to-end tests. The three end-to-end groups download one shared asset build from the same checkout. The final coverage step runs `pnpm run coverage:check --require-full` and fails the run if client or server coverage is below 100%.
- Docs-only changes skip the application builds and tests (`ci-changes.yml`).

Wait for the checks to be green before you mark a pull request ready for review, and before merging. If a check fails, fix it or say in the pull request why the failure is unrelated; do not merge on red.

## Keep pull requests small

Small pull requests are reviewed faster and are easier to revert. CI reports on size rather than blocking it: the "Tests" workflow posts and updates a single summary comment on each pull request (`pnpm run coverage:pr-summary`) that includes

- line changes in the pull request,
- CI job and step timing snapshots, including log links and the slowest completed step, and
- changes to direct runtime dependencies and to the resolved packages in `pnpm-lock.yaml`, plus an inventory of the production dependencies installed in the production image.

These reports do not fail the build, so keep an eye on the numbers yourself: split unrelated changes into separate pull requests, and add a dependency only when you can say why it is needed. Dependabot opens weekly update pull requests (`.github/dependabot.yml`).

## What stays out of the repository

Tooling for coding assistants and local agent harnesses (session state, plans, scratch notes, local worktrees, per-user settings) does not belong in pull requests. Keep it in your own checkout or global configuration, not in the repository. The existing shared files (`AGENTS.md` and the short pointer files that refer to it) are the exception; change guidance there rather than adding new assistant-specific files. Worktrees go under `.worktrees/`, which is gitignored.
