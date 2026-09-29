## Why

Upgrade the application runtime independently of the remaining React migration,
so runtime compatibility can be reviewed, deployed and rolled back separately.

## What Changes

- Standardise development, CI and production on Node.js 24 and npm 11.
- Update dependencies and runtime integration only where required for installation,
  builds or existing application behaviour under the new runtime.
- First validate Webpack 4.47.0 with the existing Angular and React bundles.
- Retain current routes, frontend frameworks, Agenda, MongoDB driver and database.

## Impact

Runtime declarations, container images, dependency lockfile, build tooling and
any necessary server compatibility fixes are affected. Existing user-facing
behaviour and stored data remain unchanged. No database migration is required.
Deploy matching application and worker images; rollback uses the previous images.
Clean installations, both bundles, production images, worker behaviour and the
existing client/server coverage and browser suites must be verified.
