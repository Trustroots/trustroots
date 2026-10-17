## Context

Facts below are from `main` at the time of writing.

- One `package.json`, pnpm 11, Node 24, Vite 8, React 19, Mongoose 8. `pnpm-workspace.yaml` holds overrides only; there are no workspace packages.
- 15 feature folders under `modules/<x>/{client,server,shared,tests}`. `modules/*/shared` holds typed contracts used by both sides.
- `scripts/ci/check-module-graph.mts` and `module-graph-baseline.json` fail CI on any new link between modules, or on a removed link still in the baseline, so the graph can only shrink. Today: 14 modules with links, 63 import links, 12 model-lookup links, and a single cycle containing 13 modules (`core` imports 11 other modules).
- Server wiring is by globs in `config/assets/default.mts` (models, routes with `core` last, policies, config, views) plus a hand-written job list in `config/lib/worker.mts`.
- 70 module source files and about 200 test files import the root's `config/` (mostly `config/client/i18n` 23, `config/config` 9, `config/lib/logger` 4).
- `apps/android` and `apps/ios` already exist as native apps outside the JS workspace.
- A 100% coverage gate and a 167-test end-to-end baseline run against one merged report.

## Goals / Non-Goals

Goals:

- Make module dependencies visible in `package.json` and enforceable.
- Let a contributor run lint, typecheck and tests for a change plus its dependents.
- Keep every step small, independently useful and non-breaking for open pull requests.

Non-goals:

- Independent deploys, separate bundles or separate databases.
- Merging with or sharing a repository with Nostroots.
- Changing runtime behaviour, URLs, API shapes or the database.

## Decisions

### Four tiers, imports only go down

```
apps/web        runs things: server and worker entries, client entry, build config, public/, Dockerfile, pm2 files
layers/server   composes modules into one server: today's config/lib plus one ordered list of module server entries
layers/shell    composes modules into one client: router, layout, providers, route table
modules/<x>     the 15 features, same folders as today
packages/*      shared code with no feature knowledge: config, logger, i18n, ui, testutils
tooling/*       guards, tsconfig and eslint presets (outside the tiers)
```

An app may import layers, modules and packages; a layer may import modules and packages; a module may import packages and, as a declared dependency, other modules; a package imports only packages. The layout follows the convention already used in other pnpm and Turborepo repositories of the maintainers' ecosystem, and `apps/` already exists for the native apps.

Alternative considered: keep the root as the app and add only `packages/*`. Rejected because the most important package would sit outside the layout and every future tool would need a special case for it. The cost is moved to the last step so it can be skipped or delayed without affecting the others.

Alternative considered: make the app shell a package. Rejected: the shell composes modules, which a package may not do. It is a layer.

### Names

`layers/server` rather than `layers/api`: the server also renders the HTML page and runs the worker. Renaming is a one-line change if maintainers prefer `api`.

### Modules become workspace packages in place

Each `modules/<x>` gets a `package.json` (`@trustroots/<x>`, `"type": "module"`, explicit `exports`, `workspace:*` dependencies generated from the module-graph baseline, and `lint`, `typecheck` and `test` scripts). No file moves and no import changes, so no open pull request needs a rebase.

The 19 existing nested `package.json` files that contain only `{"type": "commonjs"}` stay as they are or are folded into the new package files in a separate step.

### Source-only, private packages

`exports` point at source (`./client/*`, `./shared/*`, `./server`), with a browser stub for `./server` that throws. There is no build step except in `apps/web`. Vite, Jest and the `tsconfig` files resolve the sources directly.

### Module-to-module dependencies

Allowed only as declared `workspace:*` dependencies through the other module's `exports`, and frozen by the baseline. The long-term rule is that a module uses another module's `shared/` contracts only. Because of the existing cycle, the honest rule today is "frozen, then shrinking".

### Third-party dependencies stay at the root first

They move per package through a pnpm `catalog:` only at the end. Node resolves upwards from every package to the root, so nothing breaks on day one.

### Turborepo

Turbo reads the `workspace:*` graph and runs `lint`, `typecheck` and `test` for changed packages and their dependents (`turbo run … --affected`). Packages are source-only, so these tasks have no `dependsOn`. `build` exists only in `apps/web`. Each module's `test` calls the existing root Jest or Mocha setup with a path filter, avoiding 15 copies of the configuration. Server tests still need MongoDB from the existing Docker service; Turbo does not start it.

Coverage stays one uncached root task. Turbo's per-package `test` serves the contributor loop and the pull request fast path; it never decides the coverage gate, and CI on `main` continues to run the full suite.

Until the module cycle shrinks, "affected" from `core` or `users` is nearly everything. The benefit starts with leaf modules (`support`, `stats`, `sparkpost`, `references-thread`) and grows as the cycle is untangled.

Alternative considered: moon. Rejected for now: it brings a second toolchain manager and configuration language, and Turborepo is enough for a pnpm workspace.

### Guards

- The module-graph baseline moves into `tooling/guards` and keeps its ratchet behaviour.
- `check-modules`: tier direction, fixed `exports` keys with no wildcard deep exports, and a matching `workspace:*` dependency for every import that crosses a package. It ships with negative fixtures proving each rule fires.
- ESLint `no-restricted-imports`: client code may not import `*/server`; `shared/` may not import React, Mongoose, client or server code; `packages/ui` imports no modules.
- A model-ownership check: a lookup of a model the module does not own requires a declared dependency.
- `AGENTS.md` gets a "Layout" section describing the tiers and the rule "add a dependency between modules only in `package.json`, and say why in the pull request".

### Migration rules that protect open pull requests

1. Create the new home first, then turn the old path into a one-line re-export shim.
2. Rewrite imports later, per module, with a codemod, only after the open pull requests touching those lines have merged.
3. `@` keeps pointing at the repository root, also from `apps/web`, until the shims are dropped.
4. Each step is useful on its own. Stopping after any step leaves no half-finished state.

## Where the current code fights the layout

| Friction | Size | Resolution |
| --- | --- | --- |
| Modules import the root `config/` | 70 source and about 200 test files | Extract `packages/config`, `logger`, `i18n` and a small db package; old files become `export * from '@trustroots/…'`. `render` and `agenda` are real upward calls and become hooks that a module passes through its `server/index.mjs`. |
| `modules/core` is a shell, shared UI and a feature at once | `core` imports 11 modules; `users` imports `core` heavily for components | Take apart over several steps: router and layout to `layers/shell`, catch-all and error routes to `layers/server`, shared components to `packages/ui` or other packages. What remains stays a module until empty. |
| Server wiring by globs relative to the working directory, plus a hand-written job list | 5 glob groups, 1 job list | Each module gets `server/index.mjs` exporting its models, policies, routes, jobs and config; `layers/server` lists them in order (`core` last). At first each entry globs its own folders relative to its own file, so pull requests that add a route file keep working. |
| `@/` alias points at the root | about 1,340 lines | Do not rewrite for the move. Rewrite per module with a codemod once its open pull requests have merged. |
| Root-relative tooling | Dockerfile, pm2 files, `Justfile`, test scripts, Playwright, ESLint overrides, ~80 npm scripts | Most stay at the root because they cover the whole repository. Only what runs the app moves with `apps/web`. |
| Model coupling by string | 12 links in the baseline | Model-ownership check; queries are unchanged. |
| Global coverage gate | one merged report | Stays a single uncached root task. |

## Sequence

Each item is its own pull request with a plain-sentence title and unchanged coverage.

1. (done) Module-graph baseline and ratchet.
2. This change.
3. Workspace in place plus Turbo: `packages:` in `pnpm-workspace.yaml`, a `package.json` for each module, `turbo.json`, per-module scripts, a `check:affected` script. No file moves.
4. `packages/config`, `packages/logger`, `packages/i18n`, and `testutils` joining the workspace, with shims.
5. `packages/ui`: design tokens and primitives (the shared UI package exploration), as `@trustroots/ui`. Independent of 4.
6. Tier guards in `tooling/guards`, with the existing cycle baselined.
7. `layers/server`: per-module `server/index.mjs` and one ordered list replacing the globs and the job list.
8. Model-ownership guard.
9. `layers/shell`: router, layout and providers out of `core/client`; each module exports its routes.
10. `apps/web`: entry points, build config, `public/`, Dockerfile and pm2 files move in. Needs a production-image check from the maintainer who runs deploys.
11. Untangling, one pull request at a time: break `core` ↔ `users` edges, rewrite `@/modules/x` to `@trustroots/x` per module, drop shims, move third-party dependencies per package through `catalog:`, and consider a Turbo remote cache only if measurements justify it.

Steps 3 to 6 do not conflict with module code. Steps 7 and 9 are the riskiest and should wait for a quiet period in the pull requests that touch server start-up and the router.

## Risks / Trade-offs

- Tooling choices are the maintainers' call. Step 3 is the first step with a visible cost and is the natural point to stop if the direction is not wanted.
- `apps/web` changes deploy paths; mitigated by doing it last and checking the production image start-up (`scripts/ci/check-production-startup.sh`) before merge.
- Re-export shims leave two ways to import `config`, `logger` and `i18n` for a while. The guard warns on the old paths for new code, and step 11 removes the shims.
- The cycle stays until step 11, so the guards freeze the problem rather than fixing it. That is still the main gain.
- Native dependencies (`canvas`, `sharp`) and the Docker images must be re-verified under the workspace layout in step 3.
- No independent deploys result from this change.

## Open Questions

- Is `layers/server` the right name, or `layers/api`?
- Should `packages/ui` land as step 5, or stay a plain folder until a second consumer exists?
- Should `tooling/*` be part of the workspace from step 3 or from step 6?
