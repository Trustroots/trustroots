## Why

Server modules, configuration and shared packages still export `export { x as 'module.exports' }` so that CommonJS server tests and a few CommonJS tools can `require()` them and receive the default object. That compatibility layer, the `.cts` tests that rely on it and the interoperability suites that check it keep CommonJS alive across the codebase. Migrating those consumers lets every module use ordinary ESM exports, continuing #3494.

## What Changes

- Migrate the CommonJS server tests (`.cts`, `.js`, `.cjs`) to `.mts` files with ESM imports. `mockModule` imports a fresh mocked copy of a module and resolves to its namespace.
- Delete tests whose only purpose is CommonJS/ESM interoperability: the `esm-*.server.tests.cts` suites, the `require()`-based loading in the route registration unit test, and assertions about `module.exports` or default-versus-named export shape.
- Remove every `module.exports` export, the `defaultExport`/`defaultInterop` aliases and `@commonjs` tags that only served it, and the CommonJS test utility shims.
- The remaining CommonJS callers read the default export: the mobile module's `.cjs` sources, tool scripts and configuration files (`*.cts`, `*.cjs`).
- Replace the scoped lint rule with ESLint's `no-restricted-exports`, which rejects a `module.exports` export anywhere in the repository.

## Impact

Affects every server module's tests and exports, the server test utilities, `config`, `packages/logger`, `bin` and a few scripts. Cross-module dependencies, routes, models and runtime behaviour are unchanged, and there is no user-facing change, data migration or deployment change. Behavioural tests, coverage and mutation floors are kept; new end-to-end coverage is unnecessary for this module-format cleanup.
