# Tighten production CSP

## Why

Reduce account takeover, data disclosure and abuse risk at existing Trustroots boundaries.

## What Changes

Remove production eval and inline-script allowances, unused script origins and plugin content. Keep development source maps, analytics, map workers and nonce-authorised bootstrapping functional. No data migration.

## Impact

Affected modules: users, core, configuration and tests. Preserve client and server coverage thresholds and existing end-to-end tests. Document deployment and compatibility implications alongside implementation.
