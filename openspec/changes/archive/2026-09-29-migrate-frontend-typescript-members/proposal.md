## Why

The users, contacts, tribes, experiences and reference-thread client modules are still JavaScript, leaving much of the member-facing React application outside the strict TypeScript checks already used by newer client code. Converting these modules now extends the existing safety net without changing the application’s behaviour or public entry points.

## What Changes

- Convert all 90 production client JavaScript modules in users, contacts, tribes, experiences and references-thread to strict `.ts` or `.tsx` modules with explicit, useful types.
- Preserve runtime behaviour, translation extraction, coverage and compatibility for existing importers.
- Keep existing client tests in JavaScript; use them to confirm the migration preserves behaviour.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `developer-tooling`: Require migrated member-facing client modules to remain included in strict TypeScript checks and retain their existing test and translation coverage.

## Impact

Affected production files are confined to the client code of the five named modules. No API, database, dependency, or user-visible behaviour changes are intended. Existing JavaScript callers and tests must continue to resolve converted modules.
