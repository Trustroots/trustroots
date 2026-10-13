# Introduce TypeScript for server code

## Why

Issue #2885 asks for server TypeScript as a separate rollout from the client. The earlier `.cts` prototype (#2878) was closed when the server moved to native ESM, so the work restarts on the ESM runtime: strict checking for opted-in files, Node 24 executing typed modules without a build step, and the 100 percent server coverage gate measuring the typed source.

## What Changes

- Add `tsconfig.server.json`, a strict NodeNext project for `modules/*/server/**/*.mts`, and run it from `npm run typecheck`.
- Execute `.mts` files directly through Node 24 type stripping (erasable syntax only), so there is no server build step and imports keep their explicit file extensions.
- Extend discovery globs, watchers, lint, formatting and NYC configuration to `.mts`, and strip types in the native ESM coverage hook before instrumenting so the existing report and gate cover the typed implementation.
- Add declaration files for untyped configuration and logging modules that typed server code imports.
- Convert `modules/stats/server/services/influx.server.service` as the pilot. Further modules follow in small batches, then `checkJs` is removed.

## Impact

Affected specification: developer-tooling. No public HTTP behaviour, database schema or deployment command changes. Typed modules are referenced by their `.mts` path from importers and tests. `tsconfig.contracts.json` keeps `checkJs` until its five payload services are converted.
