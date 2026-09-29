# Introduce client TypeScript incrementally

## Why

Client code has no static type-checking path. A focused first step can let developers convert existing React and utility files without changing the server runtime or waiting for the Vite migration.

## What Changes

- Add TypeScript and TSX support to the current Webpack, Babel, Jest and ESLint toolchain.
- Type-check client TypeScript in CI while leaving existing JavaScript unchecked.
- Keep TypeScript files visible to client coverage and translation extraction.
- Convert one tested client utility and one translated React component to demonstrate `.ts` and `.tsx` integration with JavaScript callers, the bundle, tests and translation extraction.
- Document that server implementation and API contracts remain outside this first phase.

## Impact

This changes client build tooling and developer checks, with no user-facing behaviour, database migration or deployment change. Existing JavaScript continues to compile as before. The TypeScript dependency is used at check time; Babel strips types for the bundle. The Vite migration can follow independently. End-to-end coverage is not appropriate for a tooling-only change; the production build and utility tests exercise the new path.
