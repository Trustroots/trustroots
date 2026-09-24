## Extraction boundary

This change standardises on Node 24: development and test images use 24.21.0,
while the Passenger production image supplies 24.18.0. Dependency installation
uses npm 11.19.0. The production Dockerfile asserts the Node major version; it
does not enforce patch parity with `.nvmrc`.

The hybrid Angular/React frontend, Agenda 1.0.3, MongoDB driver 3.6.11 and MongoDB
server 4.4 remain in place. This is independent of #2769 and the mobile push cleanup.

## Dependency compatibility

npm peer validation remains enabled, with a scoped MongoDB peer override for
the existing production session-store combination:

- Webpack 4.47.0 supports the existing build on Node 24. eslint-webpack-plugin
  2.7.0 supports Webpack 4 and ESLint 8; eslint-plugin-react 7.27.1 and
  eslint-watch 8.0.0 support ESLint 8.
- connect-mongo remains at the production version 4.6.0. Its declared MongoDB
  peer range is ^4.1.0, but Trustroots supplies its existing driver-3 client.
  The scoped override explicitly resolves that peer to the application's
  MongoDB 3.6.11 dependency, preserving the combination reported working in
  production. This is an intentional exception to upstream's declared support
  range, not evidence of upstream driver-3 support. Revisit it with the separate
  database/Agenda upgrade; do not downgrade the session store for this runtime
  migration.
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

## Override maintenance

Keep overrides scoped to their parent where possible. Remove each after an
upstream update resolves the requirement and installation/CI pass without it.

| Override                         | Reason                                                                                                 | Revisit when                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| node-forge 1.4.0                 | Retain the existing dependency maintenance pin                                                         | Parent dependencies resolve a suitable release |
| websocket-driver 0.7.5           | Retain the existing dependency maintenance pin                                                         | Parent dependencies resolve a suitable release |
| nan 2.28.0                       | Native compilation on Node 24                                                                          | Native parents adopt a compatible version      |
| connect-mongo.mongodb            | Preserve the production driver-3 client with connect-mongo 4.6.0 despite its driver-4 peer declaration | Database/Agenda upgrade (#2800)                |
| socks.ip-address 10.3.1          | Dependency maintenance update                                                                          | socks resolves a suitable release              |
| mocha.js-yaml, nanoid, minimatch | Refresh pinned transitive dependencies                                                                 | Mocha is upgraded                              |
| express.qs                       | Use the maintained direct qs version throughout Express                                                | Express updates its dependency                 |
| mongoose-url-slugs.extend 3.0.2  | Refresh the pinned transitive dependency                                                               | Slug library updates its dependency            |

Also revisit eslint-webpack-plugin 2.7.0 when migrating to Webpack 5.

## Verification evidence

At revision `2a1721b1b`, [CI run 35843725451](https://github.com/Trustroots/trustroots/actions/runs/35843725451)
passed both image builds, lint, 1,563 client tests and 1,721 server tests with
100% coverage, and all 214 end-to-end tests (one passed on retry).

The production startup check served `/api/languages` through Passenger and
observed Agenda starting in the worker. It verified the executable of each
actual process: Passenger application PID 82 and worker PID 1 both reported
Node 24.18.0. This verifies startup, not every worker job or a worker supervisor.
Subsequent revisions must retain green CI before merge.

The production build loads sharp for circle-image generation. The startup
check now also loads mmmagic as the `app` user and uses `detectFile` to identify
an anonymous PNG fixture, without the upload fallback or a mocked binding.
This closes the native file-detector check missing from the earlier run; its
result is enforced by the production image CI job on subsequent revisions.

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
  Push delivery remains unconditionally disabled. Worker tests are excluded only
  from the isolated mode of scripts/codex/test-server.sh; restore and verify them
  there after resolving this boundary.
- Remove legacy OpenSSL workarounds from end-to-end scripts only after verifying
  those scripts without them.
- Merge requires a passing production startup check: Passenger must serve an
  application route and the worker must start Agenda, both using Node 24. The
  production image CI job runs this check with a disposable database on an
  isolated Docker network.
- Require full coverage and browser checks on the final revision before readiness.
- Consider lockfile format 3 in a separate maintenance change.
- Complete deployment verification, then archive this proposal and update the
  living runtime specification.

There is no database migration. Rollback deploys the previous application and
worker images together.
