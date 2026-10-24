## Implementation

- [x] Land the initial proposal and migration direction (#3250). Remaining layout decisions stay open in `design.md`.
- [x] Workspace in place plus Turborepo (#3251).
- [ ] Shared root code into `packages/*` with re-export shims (separate pull request).
- [ ] `packages/ui` with design tokens (separate pull request).
- [ ] Tier guards in `tooling/guards` (separate pull request).
- [ ] `layers/server` composition and per-module server entries (separate pull request).
- [ ] Model-ownership guard (separate pull request).
- [ ] Complete `layers/shell` composition. Route-table extraction landed in #3256; header/navigation extraction is tracked below; router/layout/provider ownership remains pending.
  - [x] Move the header and its logged-in/logged-out navigation into `layers/shell`, retaining old-path re-exports and existing behaviour tests.
  - [x] Include shell components in translation extraction and verify client coverage and the production build.
- [ ] `apps/web` move (separate pull request, needs a production-image check).
- [ ] Untangling and shim removal, one module at a time.

Progress and follow-up PRs are tracked in [#3358](https://github.com/Trustroots/trustroots/issues/3358). The overall proposal remains open until the agreed migration is complete.

## Verification

- [ ] Each step leaves lint, typecheck, client and server tests, and e2e green.
- [ ] Global client and server coverage stays at 100% and the e2e baseline does not shrink.
- [ ] The production image still builds and starts.
- [ ] The module-graph baseline never grows.
- [ ] Archive this change and update the `developer-tooling` spec when the layout is in place.
