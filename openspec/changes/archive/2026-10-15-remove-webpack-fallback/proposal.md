## Why

Vite already builds production and end-to-end assets and serves local development. Keeping a separate Webpack pipeline duplicates configuration, client startup, dependencies, and test orchestration.

## What Changes

- Remove Webpack build/development commands, configuration, loaders, and plugins.
- Use the existing Vite production build in the Windows map-wheel CI job.
- Simplify end-to-end orchestration to built Vite assets, preserving every browser scenario and production CSP/RTL check.
- Remove obsolete comparison tooling and update build documentation.

## Capabilities

### Modified Capabilities

- `developer-tooling`: Vite is the only supported client build tool; the Webpack fallback commands are removed.

## Impact

This changes developer commands and CI configuration, with no intended user-facing behaviour change, API change, or data migration. Deployment keeps the same Vite assets and filenames. Existing Webpack fallback users must use `pnpm start` and `pnpm build`. Rollback uses the previous application image.
