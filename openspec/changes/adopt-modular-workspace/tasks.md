## Implementation

- [x] Land the initial proposal and migration direction (#3250). Remaining layout decisions stay open in `design.md`.
- [x] Workspace in place plus Turborepo (#3251).
- [ ] Shared root code into `packages/*` with re-export shims (separate pull request).
  - [x] Extract the logger and its metadata helpers into a private source-only workspace package; preserve shared instance identity, runtime installation and coverage. The obsolete CommonJS exports were removed later (#3694).
  - [x] Add shared analytics (#3487) and transactional email rendering (#3721) workspace packages.
  - [x] Assess configuration and i18n package boundaries and record the extraction candidates in `design.md`.
- [x] Establish the shared `packages/ui` workspace package and web design tokens.
  - [x] Add source-only primitives (#3453), Storybook (#3536) and shared Tailwind styling; the web client has since removed Bootstrap (#3751).
  - [x] Own web design tokens in the UI stylesheet and remove the Less token bridge.
- [x] Enforce tier import directions in `tooling/guards`.
  - [x] Guard shared package production imports against application code and undeclared shared workspace dependencies, with regression fixtures and local/CI enforcement.
  - [x] Reject production module imports into layers/apps, sharing literal-import analysis with the package guard and requiring no compatibility exceptions.
  - [x] Reject production layer imports into apps (#3449).
  - [x] Enforce production module client/server/shared import directions with regression fixtures and local/CI checks (#3450).
- [ ] `layers/server` composition and per-module server entries.
  - [x] Move registration of models, Express configuration and Express routes into the server layer, preserving discovery and registration order.
  - [ ] Introduce per-module entry points and an ordered list for server composition, including worker jobs.
- [x] Enforce model ownership against declared dependencies (#3448).
  - [x] Enforce that cross-module model lookups have a declared workspace dependency on the owning module; cover missing dependencies with a focused regression test.
- [x] Complete `layers/shell` composition. Route-table extraction landed in #3256; header/navigation, router/layout and provider composition are tracked below.
  - [x] Give feature modules ownership of stateful route views. The shell's file routes compose those views with URL parameters, guards and loaders.
  - [x] Move the header and its logged-in/logged-out navigation into `layers/shell`, updating imports directly and retaining existing behaviour tests.
  - [x] Include shell components in translation extraction and verify client coverage and the production build.
  - [x] Move the router entry, page layout, footer wrapper and navigation helpers into `layers/shell`, preserving old-path exports, route behaviour and coverage.
  - [x] Move application provider composition and window bootstrap reading into `layers/shell`, keeping a single bootstrap context and the existing core authentication context through compatibility exports.
  - [x] Give feature-facing context/hooks and browser navigation core-owned implementations; update all repository consumers and remove obsolete core-to-shell re-exports.
  - [x] Adopt generated file-based routing in the shell (#3716) and colocate route policy with its route (#3756).
- [x] Reassess the `apps/web` move, third-party dependency ownership and remote caching. Record the conditions for revisiting them in `design.md`.
- [ ] Untangling and shim removal, one module at a time. The server import extension migration (#3714) and later entry cleanup (#3837) removed obsolete shims.

Progress and follow-up PRs are tracked in [#3358](https://github.com/Trustroots/trustroots/issues/3358). The overall proposal remains open until the agreed migration is complete.

## Verification

- [ ] Each step leaves lint, typecheck, client and server tests, and e2e green.
- [ ] Global client and server coverage stays at 100% and the e2e baseline does not shrink.
- [ ] The production image still builds and starts.
- [ ] The module-graph baseline never grows.
- [ ] Archive this change and update the `developer-tooling` spec when the layout is in place.
