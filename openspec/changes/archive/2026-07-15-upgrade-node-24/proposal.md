## Why

Trustroots currently requires Node.js 16 and npm 7, both of which are end-of-life and prevent security fixes and current dependency updates. The development, CI, and production runtimes need to move together to a supported LTS release so that builds remain reproducible and the application can safely resume active development.

## What Changes

- **BREAKING** Require Node.js 24 and npm 11 for host development and dependency installation.
- Upgrade development, devcontainer, CI, and production container images to maintained releases that provide Node.js 24.
- Upgrade the npm lockfile and only those native, build, test, and runtime dependencies that block or invalidate Node.js 24 support.
- Remove Node.js 16 compatibility workarounds, including the npm 7 pin, obsolete node-gyp guidance, and Webpack's legacy OpenSSL provider workaround.
- Verify production builds, server and client coverage, and the existing end-to-end suite on the new runtime without reducing coverage baselines.
- Keep the MongoDB server upgrade separate; the existing MongoDB 4.4 deployment remains the database target for this change.

## Capabilities

### New Capabilities

- `runtime-platform`: Defines the supported Node.js/npm platform and requires consistent development, CI, test, and production execution on it.

### Modified Capabilities

None.

## Impact

This change affects `package.json`, `package-lock.json`, local environment checks, Docker and devcontainer images, GitHub Actions, the production Passenger image, Webpack and native modules, and development/deployment documentation. It does not intentionally change user-facing behaviour, HTTP APIs, stored data, or database schemas. Deployments must rebuild the application image; rollback uses the previous immutable application image and does not require a data migration.
