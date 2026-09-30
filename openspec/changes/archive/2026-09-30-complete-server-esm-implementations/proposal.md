# Complete server ESM implementations

## Why

The offer expiry service is the last production CommonJS implementation under `modules/*/server`. Its ESM controller currently reaches it through a CommonJS path. Native ESM files also lack lint rules against new CommonJS exports and dynamic requires.

## What Changes

- Move offer expiry logic to a native `.mjs` implementation with named and default exports, keeping its `.js` path as a synchronous adapter for existing consumers.
- Scope no-CommonJS and no-dynamic-require lint rules to server `.mjs` files. Preserve synchronous strategy loading and JSON imports with documented local exceptions.
- Record the remaining package-wide ESM constraints and keep compatibility adapters while CommonJS bootstrap, tests and scripts still consume them.

## Impact

- Affected spec: runtime-platform.
- Affected code: offer expiry service, server lint configuration and migration documentation.
- Behaviour and existing API contracts stay the same. Existing end-to-end coverage exercises offers, so this migration adds no product scenario.
