# Migrate admin, offers and search client code to TypeScript

## Why

Administration, offer management and member search still rely on unchecked JavaScript even though the client TypeScript toolchain is in place. Converting these modules makes their component props, API payloads, mapping utilities and state transitions visible to strict type-checking.

## What Changes

- Convert the remaining production JavaScript modules under `modules/admin/client`, `modules/offers/client` and `modules/search/client` to strict TypeScript and TSX.
- Keep their existing client tests in JavaScript and exercise the converted modules through the TypeScript-aware Jest resolver.
- Define the types needed for imported JavaScript contracts within the owned modules, without changing sibling module ownership.
- Preserve runtime behaviour, translation keys, coverage thresholds and the end-to-end suite.

## Impact

This is a client-side static typing change spanning administration, offers and search/map modules. It changes no user-facing behaviour, server contract, persisted data or deployment requirement. Existing JavaScript callers continue to resolve the converted modules through the TypeScript-aware Webpack and Jest configuration. Strict type-checking, scoped lint, client tests and coverage, translation extraction, and the production build validate the migration; an end-to-end test is not appropriate because no feature behaviour changes.
