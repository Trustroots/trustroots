# Tasks

## 1. Server removal

- [x] 1.1 Delete `modules/users/server/config/strategies/twitter.js`
- [x] 1.2 Remove the Twitter routes from
      `modules/users/server/routes/auth.server.routes.js`
- [x] 1.3 Remove the `/api/auth/twitter*` ACL entries from
      `modules/users/server/policies/users.server.policy.js`
- [x] 1.4 Remove `clientID`, `clientSecret`, and `callbackURL` from the
      `twitter` block in `config/env/default.js` (keep `username`)
- [x] 1.5 Remove the legacy `/auth/twitter/callback` rewrite from
      `deploy/files/prod-conf/nginx-location.conf`
- [x] 1.6 Keep `twitter` in the `removeOAuthProvider` allowlist so existing
      connections can still be disconnected

## 2. Client removal

- [x] 2.1 Remove Twitter from the connectable networks in
      `modules/users/client/views/profile/profile-edit-networks.client.view.html`
- [x] 2.2 Update privacy copy in
      `modules/pages/client/components/Privacy.component.js` and
      `public/locales/en/pages.json`

## 3. Dependency

- [x] 3.1 Remove `passport-twitter` from `package.json` and refresh the
      lockfile

## 4. Tests

- [x] 4.1 Remove the Twitter strategy block from
      `modules/users/tests/server/oauth-strategies.server.config.tests.js`
- [x] 4.2 Update Twitter route assertions in
      `modules/core/tests/server/api-routes.unit.tests.js`
- [x] 4.3 Update `tests/e2e/feature-coverage.js` oauth-providers entry
- [x] 4.4 Keep display-related tests (networks utils, statistics, admin
      obfuscation) unchanged; they cover stored legacy data
- [x] 4.5 Verify server and client coverage stay at 100% and the e2e count
      stays at baseline
