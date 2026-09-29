# Migrate spam, upload and statistics services to ESM

## Why

Continue the incremental server ESM migration with four bounded services while preserving existing controllers, workers and tests.

## What Changes

- Move spam checking, file upload validation, statistics formatting and Influx writing implementations to native `.mjs` modules with named exports.
- Keep existing `.js` paths as synchronous CommonJS adapters returning shared mutable service objects where consumers replace methods.
- Update dependency stubs and add interoperability regression coverage without changing application behaviour.

## Impact

- Affected spec: runtime-platform.
- Affected code: four core/stats services and their server tests.
- No package-wide module switch, dependency update or new product functionality. Existing end-to-end coverage exercises consumers; no additional feature scenario is required.
