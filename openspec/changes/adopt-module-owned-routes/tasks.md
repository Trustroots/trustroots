# Tasks

The work ships as pull requests 1–9. PRs 10–11 (prerendering) are optional and skipped by default. **The first pull request delivers PRs 1 and 2 together**; their tasks are ticked below.

Each PR branches from `main` after its dependencies merge and is squash-merged, so a PR is the unit of revert.

## Waves

| Wave | PRs                                                | Gate before the next wave |
| ---- | -------------------------------------------------- | ------------------------- |
| 0    | 1 + 2 (proposal, typed root and guards)            | Merged                    |
| 1    | 3 (move routes into modules) ∥ 4 (ESM build)       | PR 3 merged               |
| 2    | 5 (community) ∥ 6 (users) ∥ 7 (search) ∥ 8 (admin) | All four merged           |
| 3    | 9 (shell cleanup and archive)                      | Recommended stop          |
| 4    | 10 (prerender proposal) → 11 (prerender)           | Optional, sequential      |

## Rules for every PR

- **Router PRs do not grow the code.** Non-test production code must be net-negative or neutral against the base branch. Moves count as neutral; every line a new file boundary or helper adds is paid for by deleting what the change makes dead. Tests and docs are not counted, but tests stay free of bloat. Each PR body quotes the line count from `git diff --stat` in three groups: production, tests and docs.
- **No adapter layers.** A PR that moves code moves it as it is, and deletes the old copy in the same PR. A PR that adds a new mechanism (a guard, a typed route) deletes the one it replaces in the same PR; nothing is left behind "as a backstop".
- **No behaviour change unless stated.** URLs, flat query strings and redirect targets stay byte-identical; `pnpm check:links` and the e2e baseline are the evidence.
- **Conflict rule for PRs 5–8.** They edit only `modules/<their modules>/**` and must not touch `layers/shell/**`, `modules/core/**`, `module-graph-baseline.json` or `coverage-baseline.json`. An agent that needs a core change stops and reports.
- **Standard proof, quoted in the PR body:** `pnpm check`, `pnpm lint:modules` (baseline unchanged), `pnpm lint:packages`, `pnpm check:links`, `pnpm test:coverage` with `pnpm coverage:check` (client and server stay at 100%), and the full `pnpm test:e2e` once before pushing. Heavy runs go through `reeve heavy`.

## 1. PR 1 · docs(openspec): propose typed module-owned routes (delivered)

- [x] 1.1 Spike typed module routes, `Register` inference across module files and `lazyRouteComponent` under the IIFE build (it inlines, so PRs 5–8 do not depend on PR 4)
- [x] 1.2 Write `proposal.md`, this task list and the spec deltas (`client-routing`, `client-build`, `developer-tooling`)
- [x] 1.3 `openspec validate adopt-module-owned-routes --strict`

## 2. PR 2 · feat(routes): check route policies in beforeLoad (delivered)

- [x] 2.1 Type the root route with `createRootRouteWithContext<{ user, navigateOverride }>()`; `ReactApp` passes the context as a plain value through `<RouterProvider context>` and calls `router.invalidate()` when the member changes
- [x] 2.2 `guardFromPolicy(policy)` in `layers/shell/client/routes.tsx` throws `redirect({ href, replace: true })` for `redirectTo` and for `getReactRouteAccessRedirect`; every existing route gets `beforeLoad: guardFromPolicy(policy)`, and the root `beforeLoad` sends unknown paths to `/not-found`
- [x] 2.3 Delete the redirect `useEffect` in `layers/shell/client/ReactAppShell.tsx`, and the test-only `findRoute` export
- [x] 2.4 A Jest environment (`jest/jest.environment.cts`) exposes Node's `Response` and `Headers` to jsdom, because `redirect()` builds a `Response` and `isRedirect` checks `instanceof Response`
- [x] 2.5 Tests: the redirect tests in `ReactApp.tests.tsx` assert the URL the router lands on, plus a test that signing out re-runs the guards

Left out on purpose: a shared QueryClient, router loaders, a search-schema helper, default pending and error components, a route test helper and the `Register` declaration.

## 3. PR 3 · refactor(routes): move route policies and definitions into their modules (delivered)

Depends on PR 2. Mostly moves. It ships as two PRs: the first gives every `createRoute()` its own file under `layers/shell/client/routes/`, named the way TanStack's flat file-based routing would, composed by `layers/shell/client/routeTree.tsx`; the second does 3.1–3.5.

- [x] 3.1 Move the `REACT_ROUTE_POLICIES` entries from `modules/core/shared/react-route-ownership.mts` into `modules/<m>/shared/routes.mts`, unchanged in content and written one route per line where it fits. Admin routes apply `ADMIN_ROUTE_DEFAULTS` once instead of spreading it 22 times; `ACCOUNT_ACCESS_FOOTER` moves with users. Core keeps the types, the matcher and `NOT_FOUND_ROUTE_POLICY`, and gains `setReactRoutePolicies()`
- [x] 3.2 `layers/shell/shared/route-manifest.mts` composes the manifests and registers them; `config/lib/express.mts`, the client route tree, `scripts/ci/check-internal-links.mts` and the Jest and server test setups import it. Modules with a new `shared` folder export `./shared/*`
- [x] 3.3 Split `renderByPath` into `modules/<m>/client/routes.tsx` render maps, moving each wrapper to its owner; `RouteContext` and `renderWithUser` move to `modules/core/client/react-app/route-render.ts` and `signout` to `modules/core/client/services/browser-navigation.ts`. Each shell route file takes its renderer from its module's map; the shell keeps `createClientRouteComponent` in `route-options.tsx` and `guardFromPolicy` in `routes/__root.tsx`; no adapter module
- [x] 3.4 Delete what the move makes dead or duplicated: the shell's `RoutePolicy` type, `REACT_OWNED_PATHS`, the default export object of `react-route-ownership.mts`, the copied membership handler in the two tribes wrappers, and the hand-built location in the shell's `navigate` (`router.navigate({ href })` parses it)
- [x] 3.5 Verify: a server test that the composed manifest equals the table on `main` (`modules/core/tests/server/fixtures/react-route-table.main.json`, 83 paths), the route tests, `pnpm lint:modules` with the baseline unchanged, and the standard proof

## 4. PR 4 · build: emit an ESM client entry with hashed chunks

Depends on PR 1 only. It changes the deploy contract and has its own rollback.

- [ ] 4.1 `vite.config.mts`: `format: 'es'` and `chunkFileNames: 'chunks/[name]-[hash].js'`; keep the entry name `react-main.js` and `cssCodeSplit: false`
- [ ] 4.2 `modules/core/server/views/react-layout.server.view.html`: `type="module"` on the production script, keeping the nonce
- [ ] 4.3 `config/vite/react-main.tsx`: reload once on `vite:preloadError`, guarded so it cannot loop
- [ ] 4.4 `scripts/vite/smoke-shell.cts`: assert the module script and one lazy chunk
- [ ] 4.5 Verify: `pnpm build`, `pnpm test:vite:production`, `test:vite:development`, `test:vite:rtl`, e2e `public-core/csp.spec.ts` and the full e2e

## 5–8. Typed routes per module group

Depend on PR 3. Each converts its modules' render maps into typed `createRoute` definitions (as tuple literals, so registered paths are not widened), reads params with `Route.useParams()` instead of `getCurrentRouteParams()`, and deletes the module's render map and policy-to-route plumbing it replaces. Pages keep loading their data through their own React Query hooks.

- [ ] 5 pages, tribes, statistics, support, messages, offers, contacts and experiences
- [ ] 6 users: account and profile routes, `validateSearch` for `returnTo` and `continue`; the sign-in search must accept everything the flat parser did
- [ ] 7 search: `/search` and `/search/members`; an explicit remount key replaces `delete remountSearch.offer`; the map becomes lazy
- [ ] 8 admin and support: admin and support layouts carrying the role defaults; filters read from search instead of `window.location`

Verify each with its modules' e2e specs, the full e2e and the standard proof; screenshots where the UI could change.

## 9. PR 9 · refactor(shell): drop the policy lookup in the shell and archive the proposal

Depends on PRs 4–8.

- [ ] 9.1 `ReactAppShell.tsx` takes header, footer and title from `useMatches()` and `staticData` instead of `getReactRoutePolicy`; scroll moves to `scrollRestoration`
- [ ] 9.2 Declare `Register` and check typed `Link`s; narrow the click interceptor to `router.buildLocation`
- [ ] 9.3 Delete `getCurrentRouteParams` and `createClientRouteComponent`
- [ ] 9.4 Archive this change and update `openspec/specs/{developer-tooling,client-routing,client-build}/spec.md`

## Where to stop

Recommended: after PR 9. Earliest useful stop: after PR 3, which already has guards before render on every route and module-owned routes.

## 10–11. Prerendered public pages (optional)

A separate proposal (`prerender-public-pages`) for the 15 static sitemap URLs, anonymous default-language visitors only, behind a flag that is off by default. Do it only if SEO or first paint for public pages becomes a stated goal.
