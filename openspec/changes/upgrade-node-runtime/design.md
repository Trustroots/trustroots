## Extraction boundary

This draft changes runtime declarations and deployment/build environments while
retaining the hybrid Angular/React frontend, Agenda 1.0.3, MongoDB driver 3.6.11
and MongoDB server 4.4. It is independent of #2769 and the mobile push cleanup.

## Initial compatibility evidence

An official, checksum-verified Node 24.21.0 distribution runs with npm 11.19.0.
A trial dependency resolution with Webpack 4.47.0 failed before installation:

- connect-mongo 4.6.0 declares a MongoDB driver ^4.1.0 peer, while the application
  directly uses 3.6.11.
- eslint-webpack-plugin 3.1.1 declares Webpack ^5.0.0 while the hybrid build uses 4.

The trial Webpack bump is not committed: first decide and verify a compatible
peer graph and regenerate the lockfile. Do not imply the unchanged lockfile has
passed npm 11 installation. Avoid forcing an unrelated Agenda/driver upgrade.

## Remaining work

- Test Webpack 4.47.0 as the minimal hashing compatibility update, including old
  template loaders, both bundles, service worker and RTL assets.
- Verify mmmagic, canvas and sharp installation and behaviour on Node 24.
- Resolve Firebase runtime compatibility after the browser-push decision (#2829).
  The push delivery job is currently unconditionally disabled; do not re-enable it
  as a runtime compatibility change. Worker tests are currently excluded and need
  to be restored and verified.
- Remove legacy OpenSSL workarounds only after both builds succeed without them.
- Verify actual Passenger application/worker startup and the Node version in the
  production image. The local Docker daemon was unavailable during the initial
  investigation; no successful container build is claimed.
- Run full coverage, browser and deployment checks before marking ready.

There is no database migration. Rollback deploys the previous application and
worker images together.
