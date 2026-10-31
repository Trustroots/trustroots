# Adopt typed module-owned routes

## Why

All 83 React routes are declared in one table in `layers/shell/client/routes.tsx`, and their access policies sit in one list in `modules/core/shared/react-route-ownership.mts`. Access checks used to run in a `useEffect` in `ReactAppShell` after the page had rendered, so client navigation briefly mounted a protected page before redirecting. Routes are untyped: pages read parameters through `getCurrentRouteParams()` or `window.location`.

`adopt-modular-workspace` lists "module route interfaces" as remaining work. This change supplies them.

## What changes

- The root route is typed with `createRootRouteWithContext`. Its context is `{ user, navigateOverride }`, passed as a plain value through `<RouterProvider context>`; `ReactApp` calls `router.invalidate()` when the member changes.
- Every route checks its policy in `beforeLoad` (`guardFromPolicy`), before anything renders. The effect guard in `ReactAppShell` is deleted.
- Feature modules own their route policies and route definitions. The shell only composes them; the server keeps matching the same policies.
- Later, modules convert their routes to typed `createRoute` definitions with typed params and search, one module group per PR.
- The production client build becomes an ES module entry, still named `react-main.js`, with hashed lazy chunks.

URLs, query strings and redirect targets do not change.

## Decisions

- **Redirects throw `redirect({ href, replace: true })`** with the target `getReactRouteAccessRedirect` already returns, so sign-in and `/volunteering` targets stay byte-identical. Replace keeps the back button off a page that would redirect again.
- **Unknown paths redirect to `/not-found` in the root `beforeLoad`**, as the effect guard did.
- **The router context is a value, not a getter.** `RouterProvider` merges it into the router on every render, and `invalidate()` re-runs the guards.
- **No shared QueryClient, no route loaders through the router context.** Pages keep their own React Query hooks.
- **The shell layout stays the root route's component.** TanStack restricts `InnerWrap` to non-DOM providers.
- **Typed `Link` checking (`Register`) comes later**, once enough routes are typed for it to cost no casts.

## Affected modules

`core` (policy types and matcher), the `layers/shell` composition, and every module that owns pages: `pages`, `users`, `admin`, `support`, `offers`, `messages`, `search`, `tribes`, `contacts`, `experiences` and `statistics`.

## User-facing behaviour

Client navigation to a protected or retired route redirects before the page renders, and the redirect replaces the history entry instead of pushing one. After the ESM build lands, a tab still running the previous build reloads once when a chunk it needs is gone. Nothing else changes.
