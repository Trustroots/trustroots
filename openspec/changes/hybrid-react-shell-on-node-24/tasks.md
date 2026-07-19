## 1. Stage 1 — Shell on Node 24

- [x] 1.1 Merge latest `main` into the Node 24 upgrade branch.
- [x] 1.2 Merge the React shell (`admin-react`) onto Webpack 5 with `main` and
      `react-main` entries; keep Node 24 `package.json` / lockfile.
- [x] 1.3 Create and validate this OpenSpec change.
- [x] 1.4 Smoke React-owned public and admin routes; confirm client/server
      React shell tests pass.

## 2. Stage 2 — Angular cutover

- [x] 2.1 Migrate remaining Angular routes onto the React shell and
      `REACT_ROUTE_POLICIES`. - [x] Public pages, admin, home, welcome, navigation, not-found, `/about` - [x] Circles, messages, search members, search map, offers - [x] Auth, password, and account routes - [x] Profile view/edit and contact add/confirm
- [x] 2.2 Remove `angular*`, `ngreact`, `angular-ui-bootstrap`, and the Angular
      webpack entry. Serve React shell for all SPA/error pages.
- [ ] 2.3 Update unit and end-to-end coverage for migrated surfaces.

## 3. Stage 3 — Bootstrap 5

- [ ] 3.1 Deferred out of PR 2769 (keep Bootstrap 3 / react-bootstrap 0.33).
- [ ] 3.2 Adapt global Less/Sass imports and local Bootstrap overrides.
- [ ] 3.3 Fix renamed/removed Bootstrap 3 classes and component APIs.
      removal.
- [ ] 3.2 Adapt global Less/Sass imports and local Bootstrap overrides.
- [ ] 3.3 Fix renamed/removed Bootstrap 3 classes and component APIs.

## 4. Stage 4 — Push cleanup

- [ ] 4.1 Remove Expo push (`expo-server-sdk`, exponent notifications, `expo`
      platform).
- [ ] 4.2 Upgrade or trim the Firebase client messaging path; clear obsolete
      transitive JWT/joi packages where applicable.

## 5. Stage 5 — Verification

- [ ] 5.1 Run full client and server suites at 100% coverage.
- [ ] 5.2 Run end-to-end coverage without reducing the baseline count.
- [ ] 5.3 Archive this OpenSpec change and update living specs.
