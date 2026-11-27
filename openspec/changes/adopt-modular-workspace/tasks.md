## Implementation

- [x] Land the initial proposal and migration direction (#3250). Remaining layout decisions stay open in `design.md`.
- [x] Workspace in place plus Turborepo (#3251).
- [x] Extract shared root code into `packages/*` and retain compatibility paths with deployed consumers.
  - [x] Extract the logger and its metadata helpers into a private source-only workspace package; preserve shared instance identity, runtime installation and coverage. The obsolete CommonJS exports were removed later (#3694).
  - [x] Add shared analytics (#3487) and transactional email rendering (#3721) workspace packages.
  - [x] Assess configuration and i18n package boundaries and record the extraction candidates in `design.md`.
  - [x] Extract the supported locale catalogue and relative-time formatter into source-only workspace packages (`@trustroots/locales` and `@trustroots/relative-time` in #3954).
  - [x] Keep the legacy locale catalogue path as a symlink for the deployed Nostranslation consumer using the GitHub Contents API.
  - [x] Keep deployment configuration and browser i18n initialisation, locale loading and DOM/RTL updates in their existing application locations.
- [x] Establish the shared `packages/ui` workspace package and web design tokens.
  - [x] Add source-only primitives (#3453), Storybook (#3536) and shared Tailwind styling; the web client has since removed Bootstrap (#3751).
  - [x] Own web design tokens in the UI stylesheet and remove the Less token bridge.
- [x] Enforce tier import directions in `tooling/guards`.
  - [x] Guard shared package production imports against application code and undeclared shared workspace dependencies, with regression fixtures and local/CI enforcement.
  - [x] Reject production module imports into layers/apps, sharing literal-import analysis with the package guard and requiring no compatibility exceptions.
  - [x] Reject production layer imports into apps (#3449).
  - [x] Enforce production module client/server/shared import directions with regression fixtures and local/CI checks (#3450).
- [x] `layers/server` composition and per-module server entries.
  - [x] Move registration of models, Express configuration and Express routes into the server layer, preserving discovery and registration order.
  - [x] Introduce per-module entry points and an ordered list for server composition, including worker jobs.
- [x] Enforce model ownership against declared dependencies (#3448).
  - [x] Enforce that cross-module model lookups have a declared workspace dependency on the owning module; cover missing dependencies with a focused regression test.
- [x] Complete `layers/shell` composition. Route-table extraction landed in #3256; header/navigation, router/layout and provider composition are tracked below.
  - [x] Give feature modules ownership of stateful route views. The shell's file routes compose those views with URL parameters, guards and loaders.
  - [x] Expose the six extracted route-view files through named workspace exports and adopt them in shell routes (#3967).
  - [x] Move the header and its logged-in/logged-out navigation into `layers/shell`, updating imports directly and retaining existing behaviour tests.
  - [x] Include shell components in translation extraction and verify client coverage and the production build.
  - [x] Move the router entry, page layout, footer wrapper and navigation helpers into `layers/shell`, preserving old-path exports, route behaviour and coverage.
  - [x] Move application provider composition and window bootstrap reading into `layers/shell`, keeping a single bootstrap context and the existing core authentication context through compatibility exports.
  - [x] Give feature-facing context/hooks and browser navigation core-owned implementations; update all repository consumers and remove obsolete core-to-shell re-exports.
  - [x] Adopt generated file-based routing in the shell (#3716) and colocate route policy with its route (#3756).
- [x] Defer moving entry points into `apps/web`, per-package third-party dependency ownership and remote caching. Record the conditions for revisiting them in `design.md`.
- [x] Resolve the module-cycle and compatibility-path cleanup scope with bounded criteria. The server import extension migration (#3714) and later entry cleanup (#3837) removed obsolete shims.
  - [x] Remove the Core → Users imports and model lookups. The account page supplies language persistence, and the server layer supplies profile sanitisation, username validation and Nostr member lookups. Users still consumes Core.
  - [x] Remove remaining module import cycles through server and shell capability composition (#3944, #3948, #3954). The graph audit on 27 November 2026 found no import cycles; legitimate declared module dependencies remain.
  - [x] Move feature-facing settings, bootstrap-context hooks and browser navigation to Core-owned interfaces; shell routes adopt feature-owned route views while retaining parameters, guards and loaders (#3944, #3967).
  - [x] Retain the locale catalogue symlink required by the deployed Nostranslation Contents API consumer; remove compatibility exports only after their concrete repository consumers migrate.
  - [x] Audit the remaining Core interface consumers. Seven production call sites bypassed named Core workspace exports (four HTTP clients, two auth hooks and one app-context hook); they now use the named exports (#3970). Remaining Core deep imports are direct feature, component, shared-contract or server dependencies through declared module edges, so a wholesale path rewrite is not required.

Progress is tracked in [#3358](https://github.com/Trustroots/trustroots/issues/3358), with the bounded interface adoption and final verification in [#3966](https://github.com/Trustroots/trustroots/issues/3966). The overall proposal remains open until required CI verification is complete.

## Verification

- [x] Merged modular-workspace steps #3944 and #3954 pass lint/module-graph checks, client checks, server suites on MongoDB 4.4 and 7.0, and all E2E groups on both versions. Merged PR #3967 passed all 31 checks and the named route-view export implementation passed local `pnpm check`, graph/manifest checks and a production Vite build.
- [x] PR #3954 coverage-summary reported client and server statements, branches, functions and lines at 100.00%; both MongoDB E2E coverage jobs passed. PRs #3944, #3954 and #3967 remove no end-to-end tests; #3954 retains existing journeys and expands data-export assertions.
- [x] PR #3954 production image builds and starts on MongoDB 4.4 and 7.0; smoke checks confirm the Express endpoint, Passenger app process, Agenda worker startup, Node 24 runtime and required production dependencies.
- [x] Module-graph and manifest checks pass; the graph has no import cycles and retains only declared dependency edges.
- [ ] Re-run the Users mutation shards after the added regression assertions in #3971 and verify each shard meets its score floor. The final aggregate failure in run 45908481408 reflected two Users shard score failures; CI re-verification is outstanding.
- [ ] Archive this change and update the `developer-tooling` spec when the layout is in place.
