## Extraction boundary

This change standardises Node 24.21.0 and npm 11.19.0 while retaining the hybrid
Angular/React frontend, Agenda 1.0.3, MongoDB driver 3.6.11 and MongoDB server 4.4.
It is independent of #2769 and the mobile push cleanup.

## Dependency compatibility

Strict npm peer validation is retained. The initial dependency conflicts have
been resolved:

- Webpack 4.47.0 supports the existing build on Node 24. eslint-webpack-plugin
  2.7.0 supports Webpack 4 and ESLint 8; eslint-plugin-react 7.27.1 and
  eslint-watch 8.0.0 support ESLint 8.
- connect-mongo is pinned to 4.4.1 because 4.6.0 requires MongoDB driver 4.
  Its scoped override uses the application's MongoDB 3.6.11 dependency.
  Revisit this pin with the separate database/Agenda upgrade.
- The React 15-only react-medium-editor wrapper is replaced by a direct React
  integration of medium-editor, retaining composition, selection, external
  resets, placeholders, keyboard callbacks and unmount cleanup.
- canvas 3.2.0 and the nan override support native installation on Node 24.
- Compatible dependency maintenance updates are included in the lockfile.

The initial diagnostic lockfile was generated with legacy peer resolution and
scripts disabled. Subsequent updates use strict npm 11 resolution, and Linux CI
uses normal `npm ci`, including installation scripts. The development CI image
also rebuilds sharp and mmmagic from source.

`.npmrc` explicitly retains lockfile format 2 to avoid unrelated format churn.
The current lockfile was refreshed with Node 24.21.0 and npm 11.19.0, without
`--legacy-peer-deps`; dependency resolution and `npm ci --dry-run` pass.
A format 3 migration is deferred as a separate maintenance task. Disabling
scripts for local lockfile generation does not establish native compatibility;
Linux image builds and suites provide that evidence.

## Verification evidence

At revision `2cbb5a9e7`, CI run 35780874096 passed development and production image
builds, client and server suites with 100% coverage, and all 214 end-to-end tests.
This does not verify actual Passenger application or production worker startup.
The subsequent dependency refresh at `f8a252a4c` has passed both image builds,
lint and the server check; client and browser checks were still running when
documented.

Earlier macOS arm64 checks with Node 24.21.0 and npm 11.19.0 passed development
and production frontend bundles, the service-worker bundle, lint and client
coverage. All three bundle builds ran without `--openssl-legacy-provider`.
Native installation on macOS arm64 still needs separate verification.

The end-to-end workflow supplies build metadata from the runner because Git
inside the container can reject the mounted checkout's ownership. Without that
metadata, the public footer lacks the commit link. This avoids relying on the
container's Git fallback to populate the footer.

## Remaining work

- Verify native installation and behaviour on macOS arm64.
- Resolve Firebase runtime compatibility after the browser-push decision (#2829).
  Push delivery remains unconditionally disabled. Worker tests are excluded in
  gulpfile.js; restore and verify them after resolving this boundary.
- Remove legacy OpenSSL workarounds from end-to-end scripts only after verifying
  those scripts without them.
- Verify actual Passenger application and production worker startup, including
  the Node version used by both processes.
- Require full coverage and browser checks on the final revision before readiness.
- Consider lockfile format 3 in a separate maintenance change.
- Complete deployment verification, then archive this proposal and update the
  living runtime specification.

There is no database migration. Rollback deploys the previous application and
worker images together.
