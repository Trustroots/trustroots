## Why

The client and its tests use TypeScript, but shared support constants, route policies and common/server fixtures still cross those boundaries without checked implementations. Typing these small modules improves route-policy and fixture checking before a broader server migration.

## What Changes

- Convert shared support categories, volunteering text and React route ownership to strict TypeScript with explicit policy and identity types.
- Convert common fixture generation and server fixture persistence to strict TypeScript, preserving existing defaults, callback support and password-cache behaviour.
- Use Node 24's built-in type stripping for modules loaded by the server; add no runtime compiler dependency or production compilation step.
- Preserve legacy CommonJS fixture entry points through thin adapters where existing extensionless imports require them.
- Include the new sources in strict type checks, linting and the existing Jest/native-server runners, retaining full coverage and all E2E scenarios.

## Impact

Affected areas: shared core/support modules, common/server fixture data helpers and developer tooling. This does not migrate controllers, database models, the module-mocking loader or all server tests. HTTP shapes, route access rules, fixture semantics and Node 24 deployment requirements remain unchanged.
