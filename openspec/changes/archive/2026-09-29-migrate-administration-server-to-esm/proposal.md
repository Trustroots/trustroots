# Migrate administration server modules to ESM

## Why

Complete the next domain slice of incremental server ESM migration while preserving public APIs and module loading.

## What Changes

- Move remaining CommonJS implementations in admin, statistics, support, pages server directories to native `.mjs` modules.
- Retain existing `.js` import paths, export shapes, shared mutable hooks and synchronous module registration.
- Adapt tests at supported dependency boundaries and add interoperability regressions.

## Impact

- Affected spec: runtime-platform.
- Affected modules: admin, statistics, support, pages, with necessary corresponding tests.
- Depends on PR #2896. No new product functionality or package-wide module switch. Existing e2e scenarios remain and coverage baselines are unchanged.
