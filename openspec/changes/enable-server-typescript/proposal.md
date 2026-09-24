## Why

The first TypeScript phase established strict checking for client TypeScript
without converting the existing JavaScript tree. Server code needs its own
type-checking configuration: it runs directly in Node.js, uses CommonJS
today, and has different dependency and module-resolution requirements.

## What Changes

- Add a separate strict, no-emit TypeScript configuration for server modules.
- Use Node's NodeNext module and type resolution without changing the
  package-wide CommonJS default.
- Add server-scoped ESLint parsing for TypeScript modules without changing
  existing JavaScript linting.
- Add an initial type declaration for the existing JSON-for-script server
  service so new TypeScript server code can call it safely.
- Keep existing server JavaScript, runtime discovery and deployment unchanged.

## Capabilities

### Modified Capabilities

- `developer-tooling`: Server TypeScript has a separate strict checker and
  Node-aware module resolution.

## Impact

This affects TypeScript configuration and the server service type surface only.
It does not execute TypeScript in production or change HTTP behaviour, persisted
data, or deployment requirements.
