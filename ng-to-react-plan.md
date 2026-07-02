# AngularJS to React Migration Feasibility Plan

Last updated: 2026-07-02

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

The main challenge is that AngularJS still owns the application lifecycle:

- App bootstrap
- `ui-router` route table
- Route guards for authentication and roles
- Route `resolve` data loading
- Header/footer visibility
- Page title behavior
- Scroll reset on navigation
- Flash/message center plumbing
- Some global app state
- Many controllers, services, directives, filters, and HTML templates

React currently runs mostly inside Angular through `ngreact`, so the migration is
best approached by first creating a React app shell, then moving routes and data
loading into React gradually.

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

The custom-router option avoids adding another major abstraction, but
`react-router-dom@5.x` would reduce custom route-matching code. Either can work.

## Current Architecture Notes

### Client Entry

The main client bundle is `config/webpack/entries/main.js`.

It imports Angular, registers all Angular modules, imports global styles, imports
module Less files, and auto-registers React `.component.js` files as Angular
directives:

- `modules/*/client/*.module.js` files register Angular feature modules.
- `require.context('../../../modules/', true, /\.component\.js$/)` loads React
  components.
- Each React component is wrapped with `reactDirective` from `ngreact`.
- Wrapped components become Angular directives on the `trustroots` module.

This means React is currently mounted by Angular templates, not by a React root.

### Angular Bootstrap

The Angular app is bootstrapped in `modules/core/client/app/init.js`:

- `angular.module(AppConfig.appModuleName, AppConfig.appModuleVendorDependencies)`
  creates the `trustroots` app.
- `angular.bootstrap(document, [AppConfig.appModuleName], { strictDi: ... })`
  starts Angular manually once the document is ready.
- The same init file also registers the base service worker.

The eventual React cutover point is here: replace Angular bootstrap with a
React root render.

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

### Server Layout

The server renders `modules/core/server/views/index.server.view.html`, which
extends `layout.server.view.html`.

The current SPA outlet is:

- `modules/core/server/views/index.server.view.html`
- `<section data-ui-view></section>`

The layout still has Angular attributes:

- `<html lang="en" ng-controller="AppController as app" ng-csp>`
- `<body ng-cloak ...>`
- Header and footer use Angular expressions/directives.

The layout injects backend data as globals:

- `title`
- `settings`
- `env`
- `isNativeMobileApp`
- `user`

A React shell can initially keep using these globals to avoid backend churn.

### Server Catch-All

The SPA catch-all lives in `modules/core/server/routes/core.server.routes.js`:

- API/module/lib/developer unknown routes return 404.
- `/circles/:tribe` renders the app with circle metadata for social tags.
- `/*` renders the app through `core.renderIndex`.

This is good for a React client router. Backend route changes should be minimal
as long as the React app continues using the same URL paths.

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

The React replacement should probably be split into:

- `AppProvider`
- `AuthProvider`
- `SettingsProvider`
- `RouteMetaProvider`
- `PhotoCreditsProvider`
- `NativeAppBridgeProvider` or equivalent utility
- `signOut()` helper

### Authentication Data

Current frontend auth service is simple:

- `modules/users/client/services/authentication.client.service.js`
- It exposes `user: $window.user || null`.

React can initially use the same `window.user` value.

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

When React owns routing, that compatibility code can be replaced by route state.

The footer is still server-rendered/Angular-controlled:

- `modules/core/server/views/partials/footer.server.view.html`
- Uses `ng-if="!app.isFooterHidden"`
- Uses `ui-sref`
- Displays photo credits through `tr-board-credits`

The footer should become a React component during the shell migration.

## Current Route Surface

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

Total: roughly 75 route states.

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

## Proposed React App Shell

Create a new React-owned shell that can eventually replace Angular bootstrap.

Candidate structure:

- `modules/core/client/app/ReactApp.js`
- `modules/core/client/app/providers/AppProviders.js`
- `modules/core/client/app/routing/routes.js`
- `modules/core/client/app/routing/Router.js`
- `modules/core/client/app/routing/useRoute.js`
- `modules/core/client/app/routing/Redirect.js`
- `modules/core/client/app/routing/RouteGuard.js`
- `modules/core/client/app/state/auth.js`
- `modules/core/client/app/state/settings.js`
- `modules/core/client/app/state/route-meta.js`
- `modules/core/client/app/state/photo-credits.js`

Root providers:

- `I18nextProvider` is already integrated through `initReactI18next`.
- `QueryClientProvider`
- `AuthProvider`
- `SettingsProvider`
- `RouteMetaProvider`
- `PhotoCreditsProvider`

Root behavior to preserve:

- Read initial `window.user`.
- Read initial `window.settings`.
- Track current route.
- Match route and params.
- Enforce auth and role guards.
- Redirect unauthenticated users consistently.
- Preserve current special case for unauthenticated profile route going to
  profile signup.
- Set page title from route metadata.
- Set header/footer hidden state from route metadata.
- Scroll to top on route changes unless a route opts out.
- Render 404 route for unknown client paths.
- Keep signout behavior compatible with push/native app behavior.

## Migration Phases

### Phase 1: Prepare React Shell While Angular Still Owns Routing

Goal: introduce reusable React providers and route/data primitives without
changing production routing yet.

Tasks:

- Add root-level React providers that can be used by existing React components.
- Centralize `QueryClient`.
- Add `AuthProvider` reading `window.user`.
- Add `SettingsProvider` reading `window.settings`.
- Add shell-compatible helpers for signout, current user updates, page title,
  and route metadata.
- Keep Angular bootstrap and `ui-router` unchanged.

This phase reduces risk by improving React infrastructure before the route
cutover.

### Phase 2: Define React Route Table

Goal: encode the current Angular route surface in a React-friendly structure.

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

Initially, routes can point to existing React components where available and
placeholder wrappers for still-Angular pages if a hybrid bridge is needed.

### Phase 3: Migrate Low-Risk React-Ready Routes

Good early candidates:

- Static pages in `modules/pages/client/components`
- `support` and deprecated `contact`
- `statistics`
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

Goal: React owns the app root and route lifecycle.

Tasks:

- Replace `data-ui-view` with a React root element.
- Replace `angular.bootstrap(...)` with `ReactDOM.render(...)`.
- Render header, footer, message center, announcements, and main route outlet
  from React.
- Keep server catch-all and initial globals.
- Ensure production and development bundles still load the same assets.
- Ensure service worker registration remains intact.

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

- Static pages such as rules, privacy, FAQ, media, volunteering, foundation,
  guide, team, contribute
- Support/contact
- Statistics
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

### Maintenance Mode

The project is in maintenance mode, so avoid broad cosmetic churn.

Mitigation:

- Keep PRs small.
- Avoid formatting-only changes.
- Avoid changing quote style or unrelated files.
- Preserve existing module boundaries where practical.

## Recommended Initial Milestones

### Milestone 1: React Provider Foundation

Deliverables:

- Root `QueryClientProvider`
- `AuthProvider`
- `SettingsProvider`
- route metadata abstraction
- signout helper
- no route cutover yet

### Milestone 2: React Route Table Prototype

Deliverables:

- React route matcher
- route metadata
- auth/admin guards
- redirect support
- tests for route matching and guards

### Milestone 3: First Route Cutover

Deliverables:

- React owns a small low-risk route group.
- Candidate: static pages or admin pages already implemented in React.
- Preserve current URLs.
- Verify e2e navigation.

### Milestone 4: App Shell Cutover

Deliverables:

- React root renders header, footer, route outlet, message center, and providers.
- Angular still present only for unmigrated islands if needed.

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

1. Build React providers and route metadata.
2. Convert route data loading to API modules and React Query hooks.
3. Move easy React-ready routes first.
4. Move complex Angular-controller routes later.
5. Cut over the app shell only when the route lifecycle is covered.
6. Remove Angular last.

Trying to remove Angular before replacing `ui-router`, route guards, route
resolves, shell behavior, and global services would be the risky approach.
