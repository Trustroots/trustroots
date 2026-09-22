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

## Build-tool compatibility follow-up

The branch now uses Webpack 4.47.0, eslint-webpack-plugin 2.7.0 (which supports
Webpack 4 and ESLint 8), eslint-plugin-react 7.27.1 and eslint-watch 8.0.0 (which
support ESLint 8). Application dependencies, including the session store, remain
unchanged.

Verified on macOS arm64 with Node 24.21.0 and npm 11.19.0:

- Diagnostic installation with `npm install --ignore-scripts --legacy-peer-deps --no-audit --no-fund`; the version 2 lockfile was regenerated with this command.
  This deliberately bypasses native build scripts and legacy peer conflicts, so
  it is not evidence of a successful normal installation. CI policy is unchanged.
- `npm run build:webpack`: Angular and React production bundles, extracted CSS
  and RTL CSS pass, with asset-size warnings.
- `npm run build:webpack-service-worker`: production service-worker bundle passes.
- `NODE_ENV=development npm run webpack`: both development bundles pass.
- All three builds ran without `--openssl-legacy-provider`.
- `npm run lint` passes.
- `npm run test:coverage:client:ci`: 274 suites and 1,560 tests pass; statements,
  branches, functions and lines each retain 100% coverage.

Strict npm 11 resolution still fails on connect-mongo 4.6.0's MongoDB ^4.1.0 peer.
A temporary trial of connect-mongo 4.4.1 also exposed react-medium-editor 1.8.1's
React/React DOM 15 peer constraints against the application's React 17. That
session-store downgrade was reverted. Resolve these explicitly before claiming
clean installation; avoid forcing an unrelated Agenda/driver upgrade.

## Remaining work

### Strict dependency resolution

Retain npm's peer validation. Use connect-mongo 4.4.1 with its MongoDB 3 driver
updated to the application's 3.6.11 patch version. Replace the obsolete
react-medium-editor wrapper with a direct React integration of the existing
medium-editor dependency, preserving input composition, selection, external
resets, placeholders and keyboard callbacks. Verify these behaviours with unit
and browser tests. Update native build dependencies for Node 24 without
changing upload detection or processing behaviour.

- Prove clean installation without bypassing peer validation or native scripts.
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
