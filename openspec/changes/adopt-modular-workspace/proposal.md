## Why

Trustroots is one pnpm package with 15 feature folders under `modules/`. The folders behave like modules, but nothing declares or enforces their boundaries: the server discovers models, routes and policies through file-search patterns, the client reaches other modules through the `@/` alias (about 1,340 `@/modules/…` import lines), and 13 of the 14 modules that depend on another module sit in one import cycle (`module-graph-baseline.json`). Model lookups by name (`mongoose.model('User')`) add 12 more links that no import shows.

Work on the codebase is increasingly parallel: most open pull requests are independent branches that touch different modules. Parallel work needs boundaries a reviewer or a tool can see, and a local loop that runs only what a change affects instead of the whole suite. The prerequisites that were open when this was first discussed have landed: pnpm (#3108), the module-graph baseline, Vite (#3187), React 19 and Mongoose 8.

## What Changes

- Adopt a four-tier workspace layout as the target: `apps/web` → `layers/{server,shell}` → `modules/*` → `packages/*`, with imports only going down, plus `tooling/*` outside the tiers. See `design.md`.
- Make each folder under `modules/` a pnpm workspace package in place, with no file moves.
- Add Turborepo with per-package `lint`, `typecheck` and `test` tasks, so contributors and agents can run `--affected`.
- Extract shared root code (`config`, `logger`, `i18n`, test utilities, UI tokens) into `packages/*`, leaving re-export shims at the old paths.
- Enforce the tiers with guards that extend the existing module-graph baseline.
- Compose the server and client through `layers/server` and `layers/shell`, and move the application entry points and build into `apps/web` last.
- Deliver all of this as a sequence of small pull requests that each leave `main` green. This change records the direction and the sequence only. It does not move any code.

## Impact

Affected: developer tooling (`developer-tooling` spec), repository layout, CI, `AGENTS.md`, and in later steps every module's `package.json`.

No user-facing behaviour changes. No data migration. Production behaviour is unchanged: still one server image, one client bundle and one MongoDB database. The `apps/web` step changes deploy paths (Dockerfile, pm2 files, `deploy/` scripts), so it needs the maintainer's production-image check before merge.

Open pull requests are protected by the migration rules in `design.md`: update imports directly unless a concrete consumer, public API or overlapping pull request needs a temporary re-export shim. Remove each shim once that need ends.

Test coverage thresholds and the end-to-end baseline are unchanged. Coverage stays one global number.
