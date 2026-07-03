# AngularJS to React Migration Feasibility Plan

Last updated: 2026-07-03

## Summary

Replacing the remaining AngularJS frontend with React is feasible, but it is a
large app-shell migration rather than a simple component rewrite.

The repo already has substantial React infrastructure:

- `react@17.0.2`
- `react-dom@17.0.2`
- `react-query@3.18.1`
- `axios@0.27.2`
- `react-i18next@11.15.1`
- Babel JSX support via `@babel/preset-react`
- Webpack 4 based client bundle
- React component tests using `@testing-library/react`
- Existing React components across most frontend modules

The first React-owned app-root phase has now been completed. AngularJS still
owns the application lifecycle for most routes, but a small public route group
now boots through a separate React root selected by the server.

AngularJS still owns these parts of the remaining app:

- App bootstrap for non-migrated routes
- `ui-router` route table for non-migrated routes
- Route guards for authentication and roles
- Route `resolve` data loading
- Header/footer visibility outside the React-owned root
- Page title behavior
- Scroll reset on navigation
- Flash/message center plumbing
- Some global app state
- Many controllers, services, directives, filters, and HTML templates

React now runs in two modes:

- Existing Angular-owned routes still mount React components through `ngreact`.
- React-owned routes render through a separate React app entry and root element.

The migration should continue by expanding React route ownership gradually while
keeping Angular-owned routes stable until they are deliberately moved.

## Version Strategy

The migration can be done without major dependency upgrades.

Recommended constraints:

- Keep `react@17.0.2` and `react-dom@17.0.2`.
- Keep `react-query@3.18.1`.
- Keep `axios@0.27.2`.
- Keep Webpack 4 and the existing Babel setup initially.
- Avoid React 18-only APIs unless a compatibility shim is introduced.
- Avoid broad package upgrades during the migration.
- If adding a router package, prefer a React 17 compatible version.

Possible routing options:

- Use `react-router-dom@5.x`, which fits React 17 and older ecosystem versions.
- Or write a small internal hook-based router around `history.pushState`,
  `popstate`, route matching, route params, and query params.

The first React-owned root uses the custom-router option with exact route
matching. `react-router-dom@5.x` remains an option if later route complexity
starts to outweigh the small internal matcher.

## Current Architecture Notes

### Client Entries

There are now two client entrypoints:

- `config/webpack/entries/main.js` for Angular-owned routes.
- `config/webpack/entries/react-main.js` for React-owned routes.

The Angular bundle still imports Angular, registers all Angular modules, imports
global styles, imports module Less files, and auto-registers React
`.component.js` files as Angular directives:

- `modules/*/client/*.module.js` files register Angular feature modules.
- `require.context('../../../modules/', true, /\.component\.js$/)` loads React
  components.
- Each React component is wrapped with `reactDirective` from `ngreact`.
- Wrapped components become Angular directives on the `trustroots` module.

The React bundle imports shared styles, initializes i18n, wraps the app in
`AppProviders`, and renders `ReactApp` into `#tr-react-root` with
`ReactDOM.render`.

~~This means React is currently mounted by Angular templates, not by a React
root.~~ React now has a root for selected URL groups, while Angular still wraps
React components on Angular-owned pages.

### Angular Bootstrap

The Angular app is still bootstrapped in `modules/core/client/app/init.js` for
Angular-owned routes:

- `angular.module(AppConfig.appModuleName, AppConfig.appModuleVendorDependencies)`
  creates the `trustroots` app.
- `angular.bootstrap(document, [AppConfig.appModuleName], { strictDi: ... })`
  starts Angular manually once the document is ready.
- The same init file also registers the base service worker.

The React-owned root does not use this bootstrap path. Direct requests for
React-owned URLs render `react-index.server.view.html`, load `react-main.js`,
and mount React directly.

The eventual full cutover still finishes here: remove the remaining Angular
bootstrap once no Angular-owned routes remain.

### Angular Vendor Dependencies

Angular dependencies are configured in `modules/core/client/app/config.js`.

Important current Angular-era dependencies include:

- `angular`
- `angular-ui-router`
- `angular-resource`
- `angular-animate`
- `angular-aria`
- `angular-sanitize`
- `angular-touch`
- `angular-message-format`
- `ng-file-upload`
- `angular-locker`
- `angular-confirm`
- `angular-loading-bar`
- `angular-ui-bootstrap`
- `ngreact`
- `angulartics`
- `angular-moment`
- `ui-leaflet`
- `angulargrid`

Many of these are not just rendering dependencies. Some imply behavior that must
be replaced or deliberately removed.

### Server Layouts

Angular-owned routes render `modules/core/server/views/index.server.view.html`,
which extends `layout.server.view.html`.

The current SPA outlet is:

- `modules/core/server/views/index.server.view.html`
- `<section data-ui-view></section>`

The layout still has Angular attributes:

- `<html lang="en" ng-controller="AppController as app" ng-csp>`
- `<body ng-cloak ...>`
- Header and footer use Angular expressions/directives.

The Angular layout injects backend data as globals:

- `title`
- `settings`
- `env`
- `isNativeMobileApp`
- `user`

The React-owned root now has parallel server templates:

- `modules/core/server/views/react-index.server.view.html`
- `modules/core/server/views/react-layout.server.view.html`

The React layout keeps the same backend bootstrap globals (`title`, `settings`,
`env`, `isNativeMobileApp`, `user`, etc.) but removes Angular shell markup and
uses `<div id="tr-react-root"></div>` as the client mount point.

### Server Catch-All

The SPA catch-all lives in `modules/core/server/routes/core.server.routes.js`:

- API/module/lib/developer unknown routes return 404.
- `/circles/:tribe` renders the app with circle metadata for social tags.
- `/*` renders the app through `core.renderIndex`.

`core.renderIndex` now uses `modules/core/shared/react-route-ownership.js` to
choose the server template:

- React-owned paths render `react-index.server.view.html`.
- All other frontend paths render the existing Angular `index.server.view.html`.

Backend route changes should remain minimal as long as React-owned routes keep
using the same URL paths.

### Global App Controller

`modules/core/client/controllers/app.client.controller.js` is one of the key
pieces to port.

It currently owns:

- `app.user`
- `app.appSettings`
- language names
- `app.signout`
- `app.goHome`
- `app.photoCredits`
- `app.isFooterHidden`
- `app.isHeaderHidden`
- `app.isNativeMobileApp`
- Medium Editor default options
- service unavailable modal
- user update handling
- `$stateChangeStart` auth and role guards
- `$stateChangeSuccess` header/footer state, scroll reset, and photo credits
- signout flow, including push cleanup and native app bridge signaling

The React root has started this replacement in
`modules/core/client/react-app/AppProviders.js`, `ReactApp.js`, `routes.js`,
`bootstrap.js`, and `ReactFooter.js`.

Remaining React shell work should probably be split into:

- richer `AuthProvider`
- richer `SettingsProvider`
- `RouteMetaProvider`
- `PhotoCreditsProvider`
- `NativeAppBridgeProvider` or equivalent utility
- `signOut()` helper

### Authentication Data

Current frontend auth service is simple:

- `modules/users/client/services/authentication.client.service.js`
- It exposes `user: $window.user || null`.

React-owned routes now read the same `window.user` value through
`getBootstrapData()` and `AppProviders`.

Longer term, auth state should be owned by an `AuthProvider` that can refresh
or mutate current-user state after profile/account updates.

### i18n

React i18n is already set up in `config/client/i18n.js`.

It uses:

- `i18next`
- `react-i18next`
- `i18next-http-backend`
- `i18next-browser-languagedetector`
- `moment`

It also handles:

- Cookie-based language detection
- RTL direction on the document
- Loading `assets/main.rtl.css`
- Moment locale changes

This is already suitable for the React app shell.

### Header and Footer

The header is already a React component:

- `modules/core/client/components/AppHeader.component.js`
- Included from `modules/core/server/views/partials/header.server.view.html`
  through Angular/ngreact.

It still listens to Angular route changes through `angular-compat`:

- `$on('$stateChangeSuccess', ...)`

For React-owned routes, `ReactApp` renders `AppHeader` directly and passes the
bootstrap user plus a React-side signout handler. The Angular compatibility code
is still needed while Angular-owned routes render the header through `ngreact`;
the React-owned root currently uses full page loads for path changes, so the
compatibility listener is harmless there.

The footer is still server-rendered/Angular-controlled on Angular-owned routes:

- `modules/core/server/views/partials/footer.server.view.html`
- Uses `ng-if="!app.isFooterHidden"`
- Uses `ui-sref`
- Displays photo credits through `tr-board-credits`

React-owned routes now render `ReactFooter`, including footer links and
`BoardCredits`. Angular-owned routes still use the server/Angular footer until
those routes move.

## Current Route Surface

React now owns the first low-risk public route group through
`modules/core/shared/react-route-ownership.js` and
`modules/core/client/react-app/routes.js`:

- `/contact`
- `/contribute`
- `/faq`
- `/faq/bugs-and-features`
- `/faq/circles`
- `/faq/foundation`
- `/faq/technology`
- `/foundation`
- `/guide`
- `/media`
- `/privacy`
- `/rules`
- `/statistics`
- `/support`
- `/team`
- `/volunteering`

These routes boot through the React server template and `react-main` entry on
direct page load. Links between Angular-owned and React-owned route groups use
normal full-page navigation.

Angular route files are under `modules/*/client/config/*.routes.js`.

Observed route files:

- `modules/admin/client/config/admin.client.routes.js`
- `modules/contacts/client/config/contacts.client.routes.js`
- `modules/core/client/config/core.client.routes.js`
- `modules/messages/client/config/messages.client.routes.js`
- `modules/offers/client/config/offers.client.routes.js`
- `modules/pages/client/config/pages.client.routes.js`
- `modules/search/client/config/search.client.routes.js`
- `modules/statistics/client/config/statistics.client.routes.js`
- `modules/support/client/config/support.client.routes.js`
- `modules/tribes/client/config/tribes.client.routes.js`
- `modules/users/client/config/users.client.routes.js`

Approximate state counts from route files:

- Users: 26 states
- Pages: 18 states
- Admin: 10 states
- Offers: 7 states
- Search: 3 states
- Tribes/circles: 3 states
- Contacts: 2 states
- Messages: 2 states
- Support: 2 states
- Statistics: 1 state
- Core: 1 not-found state

Total before the first React-owned group: roughly 75 route states. The public
pages/support/statistics group above has now moved to React ownership, but the
Angular route files still represent the remaining route surface and some legacy
definitions for migrated public pages.

Important Angular route features to replace:

- `url`
- route params
- query params
- abstract parent routes
- nested child routes
- named views, especially search map/sidebar
- `requiresAuth`
- `requiresRole`
- `footerHidden`
- `headerHidden`
- `data.pageTitle`
- `resolve`
- redirects such as `/offer` to `/offer/host`
- 404 fallback

## Angular HTML Templates

There are about 50 Angular client templates under `modules/*/client/views`.

Largest template-heavy areas:

- `modules/users/client/views`
- `modules/search/client/views`
- `modules/offers/client/views`
- `modules/contacts/client/views`
- `modules/tribes/client/views`
- `modules/core/client/views`

These templates contain Angular expressions, `ng-include`, `ng-controller`,
`ui-view`, `ui-sref`, and custom directives. They need to be converted to React
components or removed when equivalent React components already exist.

## Data Loading Strategy

There are already many React-era API modules using `axios`, for example:

- `modules/core/client/api/languages.api.js`
- `modules/support/client/api/support.api.js`
- `modules/users/client/api/users.api.js`
- `modules/users/client/api/search-users.api.js`
- `modules/users/client/api/block.api.js`
- `modules/tribes/client/api/tribes.api.js`
- `modules/offers/client/api/offers.api.js`
- `modules/messages/client/api/messages.api.js`
- `modules/contacts/client/api/contacts.api.js`
- `modules/references-thread/client/api/reference-thread.api.js`
- `modules/admin/client/api/*.js`
- `modules/experiences/client/api/experiences.api.js`

Remaining Angular services often use `$resource`, such as:

- `Users`
- `UsersMini`
- `UserProfilesService`
- `UserMembershipsService`
- `SignupValidation`
- `TribeService`
- `TribesService`
- `OffersService`
- `OffersByService`
- `Contact`
- `ContactByService`
- `ContactsListService`
- `SettingsService`
- `LocationService`

Recommended approach:

- Prefer explicit `axios` API modules.
- Wrap read operations in React Query hooks.
- Keep mutations as explicit API functions plus `useMutation` where useful.
- Create one root `QueryClientProvider`, not per-component query clients.
- Preserve current API endpoints initially.
- Avoid changing server controllers unless the frontend migration reveals a real
  API gap.

Current anti-pattern to clean up later:

- Some components create their own `QueryClient` and local
  `QueryClientProvider`.
- The React shell should centralize this.

## Current React App Shell

The first React-owned shell now exists.

Implemented structure:

- `config/webpack/entries/react-main.js`
- `modules/core/server/views/react-layout.server.view.html`
- `modules/core/server/views/react-index.server.view.html`
- `modules/core/shared/react-route-ownership.js`
- `modules/core/client/react-app/ReactApp.js`
- `modules/core/client/react-app/AppProviders.js`
- `modules/core/client/react-app/bootstrap.js`
- `modules/core/client/react-app/routes.js`
- `modules/core/client/react-app/ReactFooter.js`

Implemented root behavior:

- Read initial bootstrap globals through `getBootstrapData()`.
- Provide app bootstrap data through `AppProviders`.
- Centralize a root `QueryClientProvider` for the React-owned root.
- Expose current user/settings/app config through React hooks.
- Match the current path against the first React-owned route table.
- Render `AppHeader`, `ReactFooter`, and the route component from React.
- Set page title from React route metadata.
- Scroll to top on route changes.
- Preserve service worker registration from the React entry.
- Preserve direct URL paths and server catch-all behavior.
- Keep Angular bootstrap and `ui-router` unchanged for non-migrated routes.
- Use full-page navigation across React-owned and Angular-owned route groups.

Remaining shell behavior to add before moving protected or complex routes:

- Auth and role guards equivalent to Angular `requiresAuth` and `requiresRole`.
- Redirect behavior, including the unauthenticated profile special case.
- Route params and query param helpers beyond the current exact public paths.
- Header/footer hidden metadata.
- Route-level data loading conventions.
- Better photo credits state.
- Current-user mutation/refresh behavior after account/profile updates.
- Full signout parity, including push cleanup if needed outside the current
  `/api/auth/signout` redirect.
- A React 404/fallback strategy that matches the desired server/client status
  behavior.

## Migration Phases

### Phase 1: Incremental React Root For First Public Routes

Status: completed.

Goal: introduce a React-owned app root for a low-risk URL group while Angular
continues serving the rest of the app.

Completed:

- ~~Add root-level React providers that can be used by existing React
  components.~~ Added `AppProviders` for the React-owned root.
- ~~Centralize `QueryClient`.~~ Added one root `QueryClientProvider` in
  `AppProviders`.
- ~~Add `AuthProvider` reading `window.user`.~~ Added `useAuth()` backed by
  bootstrap data.
- ~~Add `SettingsProvider` reading `window.settings`.~~ Added `useSettings()`
  backed by bootstrap data.
- ~~Add shell-compatible helpers for signout, current user updates, page title,
  and route metadata.~~ Added page-title updates, route metadata for the first
  route group, and a React-side signout redirect. Current-user mutation remains
  future work.
- ~~Keep Angular bootstrap and `ui-router` unchanged.~~ Angular remains the
  owner of non-migrated routes.
- Added `react-main` as a separate Webpack entry while keeping `main` intact.
- Added React server templates with `#tr-react-root`.
- Added server template selection through `isReactOwnedPath()`.
- Added a shared React-owned path list.
- Moved `/contact`, `/contribute`, `/faq*`, `/foundation`, `/guide`, `/media`,
  `/privacy`, `/rules`, `/statistics`, `/support`, `/team`, and
  `/volunteering` to React ownership.
- Added focused tests for route ownership and initial React shell behavior.

This phase established the hybrid production shape: React owns selected direct
page loads, Angular owns the rest, and route-group transitions use full page
loads.

### Phase 2: Harden React Route Table And Shell Metadata

Goal: expand the minimal public-page route table into a route model that can
support protected routes and more Angular route semantics.

Route table fields should cover:

- path
- component
- child routes
- params
- query params
- `requiresAuth`
- `requiresRole`
- `footerHidden`
- `headerHidden`
- `pageTitle`
- `noScrollingTop`
- redirect behavior

Current state:

- Exact public paths and page titles are implemented.
- Route ownership is shared by server and client.
- Auth/admin guards, params, nested routes, redirects, and hidden-header/footer
  metadata still need to be added before moving protected routes.

Avoid placeholder wrappers for Angular pages inside React for now. The current
hybrid strategy keeps route groups separate and uses full page loads between
React and Angular ownership.

### Phase 3: Migrate Remaining Low-Risk React-Ready Routes

Already moved:

- Static pages in `modules/pages/client/components`
- `support` and deprecated `contact`
- `statistics`

Remaining low-risk candidates:

- Many `admin` pages
- `messages` routes
- `search-users`
- `not-found`
- `welcome`

Reasoning:

- Many of these already render React components through Angular routes.
- They have fewer Angular controllers/templates.
- They exercise route metadata and auth guards without the hardest form/map
  behavior.

### Phase 4: Migrate Medium-Risk Routes

Candidates:

- Circles list and circle detail
- Profile display routes
- Contacts list/common/contact flows
- References
- Account/profile auxiliary React components

Main work:

- Replace Angular route resolves with React Query.
- Convert remaining Angular templates.
- Preserve nested tabs/subroutes.
- Replace `ui-sref` with React navigation links or plain links intercepted by
  the router.

### Phase 5: Migrate High-Risk Flows

Harder candidates:

- Search map
- Profile edit
- Signup
- Signin
- Password reset
- Confirm email
- Offer host/edit
- Offer meet list/add/edit
- Contact add/confirm

Reasons these are harder:

- Angular controllers contain behavior, not just rendering.
- They use route resolves.
- They have form validation and submission flows.
- They interact with uploads, maps, locations, native app behavior, or redirects.
- They likely have more subtle user-facing regressions.

### Phase 6: React Cutover

Goal: React owns the remaining app root and route lifecycle.

Tasks:

- Expand the existing React root until no Angular-owned routes remain.
- Stop rendering `index.server.view.html` for frontend app routes.
- Remove the remaining `data-ui-view` path.
- Remove the remaining `angular.bootstrap(...)` path.
- Render message center and announcements from React.
- Keep server catch-all and initial globals.
- Ensure production and development bundles still load the same assets.
- Ensure service worker registration remains intact in the React entry.

### Phase 7: Remove Angular

Only after all routes are React-owned:

- Remove `ngreact` wrapper registration.
- Remove Angular modules and route files.
- Remove Angular controllers.
- Remove Angular services replaced by API modules/hooks.
- Remove Angular directives/filters.
- Remove Angular client templates.
- Remove Angular-specific tests.
- Remove Angular dependencies from `package.json`.
- Simplify Webpack HTML template loader if no longer needed for Angular
  templates.
- Simplify server layout by removing Angular attributes.

Do this after the migration is complete, not at the beginning.

## Route Area Complexity

### Low Complexity

Likely easiest:

- ~~Static pages such as rules, privacy, FAQ, media, volunteering, foundation,
  guide, team, contribute~~ moved to the first React-owned root.
- ~~Support/contact~~ moved to the first React-owned root.
- ~~Statistics~~ moved to the first React-owned root.
- Admin pages that already render React components
- Not found page

### Medium Complexity

Requires data loading and route-state care:

- Messages
- Circles list/detail
- Profile view
- Contacts display
- References
- Search users

### High Complexity

Should be migrated late:

- Search map
- Profile edit
- Signup/signin/password flows
- Offer host/meet editing
- Upload/photo/location/editors
- Push notification flows
- Native mobile app bridge behavior

## Compatibility Requirements

Preserve these behaviors during migration:

- Current URLs.
- Server catch-all behavior.
- Social metadata for `/circles/:tribe`.
- Auth-required route redirects.
- Admin role route redirects.
- Special unauthenticated profile behavior.
- Header hidden and footer hidden metadata.
- Page title metadata.
- Scroll reset on route change.
- Existing translation behavior.
- RTL CSS loading.
- Service worker registration.
- Route ownership consistency between server and client while the app is hybrid.
- Full-page navigation between React-owned and Angular-owned route groups.
- Push notification initialization and cleanup.
- Native mobile app wrapper behavior.
- Signout path `/api/auth/signout`.
- API routes and request/response shapes.

## Testing Strategy

Use a combination of focused unit tests and end-to-end coverage.

Recommended test focus:

- Route matching and redirects.
- Auth guard behavior.
- Admin role guard behavior.
- Header/footer visibility by route.
- Page title behavior.
- Data hooks for converted `$resource` services.
- Profile route fallback when user does not exist.
- Signup/signin continuation behavior.
- Search map query params.
- Offer edit/add flows.
- Contact add/confirm flows.
- Signout behavior.

Useful existing test types:

- Jest component tests with Testing Library.
- Route ownership/server selection tests for the hybrid root.
- Existing Angular route/controller tests while routes are still Angular-owned.
- Playwright e2e tests under `tests/e2e`.

As Angular routes are converted, port route tests from Angular `$state` tests to
React router tests.

## Main Risks

### Hidden App Shell Behavior

`AppController` contains behavior that users experience globally. Losing any of
that behavior would create subtle regressions.

Mitigation:

- Port it deliberately into React providers.
- Add tests around route guards, route metadata, signout, and user updates.

### Route Resolve Semantics

Angular `resolve` blocks load data before route rendering. React Query usually
renders loading states while data loads.

Mitigation:

- Decide per route whether to block rendering or show a loading state.
- Preserve current UX for sensitive pages.
- Use route-level loader components where necessary.

### Nested and Named Views

Angular `ui-router` supports abstract parent states and named views. The search
route uses separate map/sidebar views.

Mitigation:

- Model these as React layouts with nested outlets or explicit layout
  components.
- Migrate search late.

### Angular Services and `$resource`

Several controllers rely on `$resource` objects with `$promise` and mutation
methods.

Mitigation:

- Replace with plain API functions returning promises.
- Keep response shapes compatible.
- Avoid trying to emulate `$resource` unless absolutely necessary.

### Forms and Validation

Signup, profile edit, offer edit, and password flows likely contain Angular form
and validation behavior.

Mitigation:

- Migrate form flows one at a time.
- Preserve server validation.
- Add focused tests for client validation and submit behavior.

### Global Links

Many templates and components use `ui-sref`, while many React components already
use plain `<a href="/...">`.

Mitigation:

- Prefer plain URLs for compatibility during migration.
- Add a React `Link` only where client-side navigation is needed.
- Do not require every link to change in one pass.

### Route Ownership Drift

The hybrid app depends on the server and React route table agreeing about which
paths are React-owned.

Mitigation:

- Keep `modules/core/shared/react-route-ownership.js` as the shared ownership
  source.
- Test direct loads for React-owned and Angular-owned paths.
- Update route ownership and React route definitions together.

### Maintenance Mode

The project is in maintenance mode, so avoid broad cosmetic churn.

Mitigation:

- Keep PRs small.
- Avoid formatting-only changes.
- Avoid changing quote style or unrelated files.
- Preserve existing module boundaries where practical.

## Recommended Milestones

### Milestone 1: Incremental React Root

Status: completed.

Delivered:

- React `react-main` entry and server templates.
- Root `QueryClientProvider`.
- Bootstrap data wrapper and hooks for user/settings/app config.
- Initial route metadata for the public route group.
- React-owned static/support/statistics routes.
- Server-side route ownership selection.
- Tests for ownership and shell behavior.

### Milestone 2: Route Semantics Parity

Deliverables:

- Auth/admin guards.
- Redirect support.
- Params/query handling.
- Header/footer visibility metadata.
- Tests for route matching, guards, redirects, and server/client ownership.

### Milestone 3: Next Route Groups

Deliverables:

- React owns the next low-risk route group.
- Candidate: admin pages already implemented in React, messages, search users,
  not found, or welcome.
- Preserve current URLs.
- Verify direct loads and cross-app navigation.

### Milestone 4: App Shell Cutover

Deliverables:

- React root renders header, footer, route outlet, message center, and providers.
- Server no longer has to choose between React and Angular templates for normal
  frontend app routes.

### Milestone 5: Remove Angular

Deliverables:

- No Angular-owned routes remain.
- No `ngreact` component registration.
- Angular dependencies removed.
- Obsolete Angular tests removed or replaced.

## Final Assessment

This migration is realistic without upgrading the frontend stack much. The repo
already has enough React to support a hook-based route and data-provider layer.

The important sequencing is:

1. ~~Build the first React root, providers, and route metadata.~~
2. Harden route semantics for guards, redirects, params, and metadata.
3. Convert route data loading to API modules and React Query hooks as routes
   move.
4. Move remaining easy React-ready routes first.
5. Move complex Angular-controller routes later.
6. Remove the Angular app-shell path only when the route lifecycle is covered.
7. Remove Angular dependencies last.

Trying to remove Angular before replacing `ui-router`, route guards, route
resolves, shell behavior, and global services would be the risky approach.
