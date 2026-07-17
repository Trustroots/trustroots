## Context

Trustroots standardises host development on `.nvmrc`, container development on the official Node image, CI on the development container plus GitHub Actions, and production on a Passenger Node image. These paths currently converge on Node.js 16 and npm 7. The repository also contains old native modules and Webpack 4-era tooling that rely on Node.js 16-era build behaviour.

The maintained `phusion/passenger-nodejs:3.1.10` image has been verified to contain Node.js 24.18.0, npm 11.17.0, and Ubuntu 24.04 LTS. It preserves the current nginx, Passenger, sticky-session, upload-limit, and process-management behaviour, avoiding an unrelated production-hosting rewrite.

## Goals / Non-Goals

**Goals:**

- Run development, CI, tests, builds, and production on Node.js 24 and npm 11.
- Keep dependency installation deterministic with an npm 11 lockfile.
- Remove compatibility workarounds and dependency versions that are unsafe or non-functional on Node.js 24.
- Preserve application behaviour, complete test coverage, and the existing end-to-end test baseline.
- Provide a simple application-image rollback path.

**Non-Goals:**

- Upgrade the MongoDB server or change stored data.
- Modernise AngularJS, React, or unrelated application dependencies.
- Replace nginx or Passenger when a maintained Node.js 24 Passenger image is available.
- Introduce new user-facing functionality.

## Decisions

### Use Node.js 24 and npm 11 as one platform boundary

All declared and executable environments will move together. Allowing Node.js 16 and 24 concurrently would double the compatibility surface and retain an unsupported production runtime. The repository will use the Node.js 24 release line for developer convenience and exact container-image releases for repeatable CI and deployment.

### Retain Passenger on its maintained Node.js 24 image

Production will move from `phusion/passenger-nodejs:2.3.1` to `phusion/passenger-nodejs:3.1.10`. Replacing Passenger with a bare Node process was considered, but it would also require redesigning nginx proxying, sticky sessions, process supervision, host binding, and container health behaviour. That is separable from the runtime upgrade and offers no necessary compatibility benefit here.

### Upgrade blockers rather than the entire dependency graph

Native modules, Firebase Admin, Webpack, and associated loaders/plugins will be upgraded or replaced when Node.js 24 installation, build, or tests demonstrate incompatibility. Unrelated application libraries remain pinned to minimise behavioural change. The unmaintained `mmmagic` native binding will be replaced by a maintained magic-byte detector rather than carrying old node-gyp workarounds.

### Remove the legacy OpenSSL provider workaround

Webpack will move to a Node.js 24-compatible release so normal and end-to-end builds no longer depend on `--openssl-legacy-provider`. Keeping the flag was considered as a temporary bridge, but it would preserve obsolete cryptography solely for legacy build tooling.

### Keep MongoDB 4.4 as the test target for this change

The Node.js driver and Mongoose versions may be adjusted only as needed for Node.js 24 compatibility, while server behaviour remains tested against MongoDB 4.4. The sequential MongoDB server migration has separate operational and rollback requirements and will follow in its own OpenSpec change.

## Risks / Trade-offs

- [Old native modules lack Node.js 24 binaries or source compatibility] → Upgrade maintained modules, replace `mmmagic`, and build dependencies from a clean Node.js 24 container.
- [Webpack 5 changes generated assets] → Compare production builds and run the complete client and end-to-end suites.
- [Old server dependencies use removed Node.js behaviour] → Run all server tests, re-enable the worker tests currently excluded for Node.js 22+, and smoke-test both web and worker processes.
- [npm 11 resolves a materially different transitive graph] → Commit the lockfile separately, review its diff, and use `npm ci` in every automated environment.
- [The newer Passenger image changes its base operating system] → Build and smoke-test the production image, retaining the previous image tag as the rollback artefact.

## Migration Plan

1. Update declared runtime versions and clean-install dependencies with Node.js 24/npm 11.
2. Resolve native and build-tool incompatibilities until development and production images build without legacy flags.
3. Run lint, client coverage, server coverage, and end-to-end tests on the Node.js 24 image.
4. Deploy the newly tagged application image through the existing deployment process.
5. If runtime validation fails, redeploy the previous application image; no database downgrade or data restoration is required.

## Open Questions

None. Any newly discovered dependency requiring a broader application migration will be documented and split into a follow-up change if it is not essential to Node.js 24 execution.
