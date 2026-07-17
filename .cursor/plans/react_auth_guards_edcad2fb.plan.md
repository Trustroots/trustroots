---
name: react auth guards
overview: Add shared React route access policy with server-side enforcement, add a real React auth provider for client rendering/layout behavior, then move the admin route group to React ownership in the same iteration.
todos:
  - id: auth-provider
    content: Create modules/core/client/react-app/auth.js with AuthProvider, useAuth(), hasRole(), isAuthenticated, user, and setUser initialized from bootstrapData.user; remove the current AppProviders-local useAuth export.
    status: completed
  - id: provider-composition
    content: Update modules/core/client/react-app/AppProviders.js so AppBootstrapContext still owns bootstrap data, QueryClientProvider stays root-level, AuthProvider wraps children with initialUser, and useSettings()/useAppConfig() keep their current API.
    status: completed
  - id: route-metadata
    content: Replace the path-only ownership list with server-safe shared React route policy metadata covering path, title, requiresAuth, requiresRole, footerHidden, headerHidden, noScrollingTop, and exported helpers for lookup/ownership/normalization.
    status: completed
  - id: server-access
    content: Update core.renderIndex to look up React route policy before rendering; redirect guest users from protected React-owned paths to signin and redirect authenticated users missing requiresRole to /volunteering before serving react-index.
    status: completed
  - id: shell-integration
    content: Update routes.js to attach React components to shared route policies and update ReactApp to consume useAuth(), honor headerHidden/footerHidden/noScrollingTop/title metadata, and perform defensive client redirects if auth state does not satisfy the matched route.
    status: completed
  - id: admin-routes
    content: Add all ten exact admin paths to shared React route policy and client routes, render the existing admin React components directly, and assign requiresAuth true, requiresRole admin, footerHidden true, and matching Angular page titles to each admin route.
    status: completed
  - id: test-coverage
    content: Add/expand Jest unit tests, React Testing Library tests, server route tests, and Playwright e2e tests so every new auth provider, access policy, shell metadata, server redirect, and React-owned admin route behavior is covered.
    status: completed
  - id: verification
    content: Run focused client/server/e2e tests, npm run lint, and any git hook checks that apply; fix failures before the iteration is considered complete.
    status: completed
isProject: false
---

# React Auth And Guard Iteration

## Scope

This iteration hardens the existing React-owned root and moves the admin route group into it. The goal is to make React-owned protected routes safe on direct page load by enforcing shared route access policy on the server, while adding explicit React auth state for client rendering, layout decisions, and future client-side navigation.

The iteration is complete only when the admin group is React-owned, server access enforcement prevents unauthorized direct loads, React has an explicit auth provider, and focused unit/RTL/server/e2e coverage plus lint/hook checks pass.

Current constraints to preserve:

- `[modules/core/client/react-app/AppProviders.js](modules/core/client/react-app/AppProviders.js)` currently exposes `useAuth()` directly from bootstrap data; replace this with an explicit auth provider rather than adding more bootstrap reads.
- `[modules/core/client/react-app/ReactApp.js](modules/core/client/react-app/ReactApp.js)` currently always renders `AppHeader` and `ReactFooter`; change this to honor route metadata.
- `[modules/core/client/react-app/routes.js](modules/core/client/react-app/routes.js)` currently supports exact public paths and titles only; after this change it attaches React components to shared policy metadata rather than being the only policy source.
- Angular guard behavior in `[modules/core/client/controllers/app.client.controller.js](modules/core/client/controllers/app.client.controller.js)` is the source of truth for access policy: unauthenticated protected routes go to signin, role failures go to `/volunteering`, and route metadata controls header/footer visibility.
- The primary access check for React-owned protected URLs runs on the server before rendering the React shell. Client-side checks are defensive UX/layout behavior, not the security boundary.
- Admin routes in `[modules/admin/client/config/admin.client.routes.js](modules/admin/client/config/admin.client.routes.js)` are good first protected candidates because they already render React components through Angular templates and share `requiresAuth`, `requiresRole: 'admin'`, and `footerHidden: true`.
- Existing e2e coverage already exercises several admin pages in `[tests/e2e/features/admin-moderation/admin-pages.spec.js](tests/e2e/features/admin-moderation/admin-pages.spec.js)`; keep that passing and add coverage for newly relevant React-owned direct-load and authorization boundaries.

## Implementation Plan

1. Add an explicit auth module.

   Create `[modules/core/client/react-app/auth.js](modules/core/client/react-app/auth.js)` with:

   - `AuthProvider({ initialUser, children })`.
   - `useAuth()` that throws a clear error outside the provider.
   - `user`, `isAuthenticated`, `setUser`, and `hasRole(role)` in the context value.
   - A pure exported `userHasRole(user, role)` helper for tests and non-hook code.

   Initialize from `bootstrapData.user`. Do not fetch current user from the API in this iteration. Do not persist auth state outside React state in this iteration.

2. Recompose providers.

   Update `[modules/core/client/react-app/AppProviders.js](modules/core/client/react-app/AppProviders.js)` so:

   - `AppBootstrapContext` still provides unmodified bootstrap data.
   - `QueryClientProvider` remains root-level and still creates one query client with `useMemo`.
   - `AuthProvider` wraps `children` and receives `bootstrapData.user` as `initialUser`.
   - `useSettings()` and `useAppConfig()` keep their current return shapes.
   - `useAuth()` is imported/re-exported from the new auth module only if needed for backwards-compatible imports.

3. Define shared route access policy.

   Extend `[modules/core/shared/react-route-ownership.js](modules/core/shared/react-route-ownership.js)` or replace its internals with a policy list while preserving current exports used by server/client code:

   - Export a server-safe `REACT_ROUTE_POLICIES` array.
   - Keep `REACT_OWNED_PATHS` derived from policy paths.
   - Keep `normalizePath(path)` behavior for query strings, hashes, empty paths, and trailing slashes.
   - Keep `isReactOwnedPath(path)`.
   - Add `getReactRoutePolicy(path)`.
   - Policy entries must contain only serializable/server-safe metadata: `path`, `title`, `requiresAuth`, `requiresRole`, `footerHidden`, `headerHidden`, and `noScrollingTop`.
   - This shared file must not import React, client components, or browser-only modules.

4. Enforce access policy before rendering React.

   Update `[modules/core/server/controllers/core.server.controller.js](modules/core/server/controllers/core.server.controller.js)` so `renderIndex`:

   - Looks up the route policy for `req.path`.
   - Continues rendering Angular for non-React-owned paths.
   - Redirects guests from React-owned `requiresAuth` or `requiresRole` routes before rendering the React shell.
   - Redirects authenticated users missing `requiresRole` to `/volunteering` before rendering the React shell.
   - Renders `react-index.server.view.html` only after access checks pass.

   Use a concrete redirect target in implementation, with tests locking the behavior. Prefer a simple signin redirect that works with the existing Angular signin route and avoid rewriting signin continuation in this iteration.

5. Use policy and auth inside the React shell.

   Update `[modules/core/client/react-app/routes.js](modules/core/client/react-app/routes.js)` so client routes are built from or checked against shared policy metadata and then attach React components/render functions. Update `[modules/core/client/react-app/ReactApp.js](modules/core/client/react-app/ReactApp.js)` so it:

   - Imports `useAuth()` from the explicit auth module.
   - Uses route policy metadata for title, header, footer, and scroll behavior.
   - Does not render `AppHeader` when `headerHidden` is true.
   - Does not render `ReactFooter` when `footerHidden` is true.
   - Skips `window.scrollTo(0, 0)` when `noScrollingTop` is true.
   - Keeps unknown React-owned paths rendering `NotFoundPage`.
   - Performs defensive client redirects for unsatisfied `requiresAuth`/`requiresRole` checks, without treating the client check as the security boundary.

6. Expand tests.

   Add or expand tests in these areas:

   - `[modules/core/tests/client/react-app/auth.tests.js](modules/core/tests/client/react-app/auth.tests.js)` for `AuthProvider`, `useAuth()`, `setUser`, `isAuthenticated`, and `userHasRole()`.
   - `[modules/core/tests/client/react-app/routes.tests.js](modules/core/tests/client/react-app/routes.tests.js)` for route lookup, policy/component alignment, admin route metadata, and ownership consistency.
   - `[modules/core/tests/client/react-app/ReactApp.tests.js](modules/core/tests/client/react-app/ReactApp.tests.js)` for RTL coverage of provider composition, authenticated vs guest rendering, header/footer metadata, `noScrollingTop`, defensive client redirects, title behavior, and admin route rendering.
   - `[modules/core/tests/server/react-route-ownership.tests.js](modules/core/tests/server/react-route-ownership.tests.js)` for shared policy helpers and normalized path lookup.
   - `[modules/core/tests/server/core.server.routes.tests.js](modules/core/tests/server/core.server.routes.tests.js)` for direct-load server behavior: public React page renders, guest admin redirects, non-admin admin redirects, admin user receives React shell, and Angular-owned pages still render Angular.
   - Existing Playwright admin specs, especially `[tests/e2e/features/admin-moderation/admin-pages.spec.js](tests/e2e/features/admin-moderation/admin-pages.spec.js)`, must still pass; add or update e2e specs for missing guest/non-admin/admin direct-load coverage and React-owned layout behavior.

7. Move the admin route group.

   Add all exact admin paths from `[modules/admin/client/config/admin.client.routes.js](modules/admin/client/config/admin.client.routes.js)` to the shared React route policy and `[modules/core/client/react-app/routes.js](modules/core/client/react-app/routes.js)`. Render the existing React admin components directly from the React route table:

   - `/admin`
   - `/admin/audit-log`
   - `/admin/acquisition-stories`
   - `/admin/acquisition-stories/analysis`
   - `/admin/messages`
   - `/admin/threads`
   - `/admin/search-users`
   - `/admin/user`
   - `/admin/reference-threads`
   - `/admin/newsletter`

   Each admin route must carry `requiresAuth: true`, `requiresRole: 'admin'`, `footerHidden: true`, and the same page title currently declared in Angular.

8. Verify admin ownership boundaries.

   Add tests that admin paths are React-owned, non-admin protected paths remain Angular-owned, and server access enforcement handles guest, non-admin user, and admin user cases. Existing Angular admin route definitions can stay in place during the hybrid period; server route ownership decides which app direct loads use.

   Do not remove Angular admin route definitions in this iteration unless a test proves they are no longer loaded in any needed Angular context. The migration boundary is route ownership, not Angular module cleanup.

## Out Of Scope

- Do not move `/messages`, `/welcome`, profile routes, or other protected route groups to React ownership in this iteration.
- Do not rewrite Angular signin/signup flows.
- Do not introduce a router dependency unless the guard work reveals a clear need.
- Do not change backend API shapes.

## Verification

Run focused React/client tests for the React app shell and auth provider, plus route policy/server access tests. React Testing Library tests must cover every new React behavior added by this iteration, including the auth provider, shell metadata handling, defensive client access behavior, and admin route rendering.

Repository quality gates must pass before considering the iteration complete:

- `npm run test:client -- --runTestsByPath <new-or-changed-client-test-files>`.
- `npm run test:server`.
- `npm run test:e2e`.
- `npm run lint`.
- Any git hook checks that run for these files.

Manual smoke checks should include a public React-owned page, direct loads for admin routes as guest/non-admin/admin users, admin footer visibility, role redirect behavior, cross-app navigation back to Angular-owned routes, and any behavior not covered by automated e2e tests.
