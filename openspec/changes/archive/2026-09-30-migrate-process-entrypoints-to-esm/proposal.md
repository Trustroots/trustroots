# Migrate process entry points to ESM

## Why

The production server and background worker still begin in CommonJS even though their domain implementations are moving to native ESM. Their launch paths are referenced by deployment, local scripts and CI, so migration must preserve those paths.

## What Changes

- Move the server and worker startup implementations to native `.mjs` files.
- Keep `server.js` and `worker.js` as synchronous compatibility entry points for existing launch commands.
- Preserve startup order, error handling and worker configuration.

## Impact

- Affected spec: runtime-platform.
- Affected code: two process entry points and their compatibility shims.
- No product behaviour or API changes. Existing server, worker startup and end-to-end checks cover these paths.
