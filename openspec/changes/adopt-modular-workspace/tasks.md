## Implementation

- [ ] Validate this proposal and get maintainer agreement on the target layout and sequence.
- [ ] Workspace in place plus Turborepo (separate pull request).
- [ ] Shared root code into `packages/*` with re-export shims (separate pull request).
- [ ] `packages/ui` with design tokens (separate pull request).
- [ ] Tier guards in `tooling/guards` (separate pull request).
- [ ] `layers/server` composition and per-module server entries (separate pull request).
- [ ] Model-ownership guard (separate pull request).
- [ ] `layers/shell` composition (separate pull request).
- [ ] `apps/web` move (separate pull request, needs a production-image check).
- [ ] Untangling and shim removal, one module at a time.

## Verification

- [ ] Each step leaves lint, typecheck, client and server tests, and e2e green.
- [ ] Global client and server coverage stays at 100% and the e2e baseline does not shrink.
- [ ] The production image still builds and starts.
- [ ] The module-graph baseline never grows.
- [ ] Archive this change and update the `developer-tooling` spec when the layout is in place.
