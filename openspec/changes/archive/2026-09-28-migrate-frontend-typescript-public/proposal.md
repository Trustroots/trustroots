# Migrate public pages and statistics client code to TypeScript

## Why

The first client TypeScript milestone established compiler and toolchain support, but public page and statistics modules still rely on unchecked JavaScript. Converting these modules makes their existing API, component and route contracts visible to the strict client type-checker.

## What Changes

- Convert the remaining JavaScript and JSX production modules under `modules/pages/client` and `modules/statistics/client` to strict TypeScript and TSX.
- Keep the corresponding client tests in JavaScript; they already exercise the production modules through the TypeScript-aware Jest resolver.
- Define any required interfaces for adjacent JavaScript dependencies within the migrated modules, without changing sibling module ownership.
- Preserve runtime behaviour, translation keys, test coverage thresholds and the existing end-to-end suite.

## Impact

This is a client-side static typing change across public pages and statistics. It does not change user-facing behaviour, server contracts, data storage or deployment requirements. Existing JavaScript callers continue to resolve the converted modules through the established TypeScript-aware toolchain. Client unit tests, strict type-checking, linting, translation extraction and the production bundle validate the migration; an end-to-end test is not appropriate because no feature behaviour changes.
