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
- Move authentication validation, email-token logic, and build-metadata
  formatting into typed `.cts` modules executed through Node 24's native type
  stripping. Keep their current CommonJS paths as adapters for existing callers.
- Keep runtime discovery and deployment commands unchanged; server type
  checking remains a separate required check because Node does not type-check.

## Capabilities

### Modified Capabilities

- `developer-tooling`: Server TypeScript has a separate strict checker and
  Node-aware module resolution.

## Impact

This affects TypeScript configuration, the authentication service, and build
metadata. It relies on the already required Node 24 runtime. HTTP
behaviour, persisted data, existing imports, and deployment commands remain
unchanged. Only erasable TypeScript syntax can be used in runtime modules.
