## Why

The client currently builds with Webpack 5. Vite is a possible simpler build
and development server, but the remaining hybrid app and backend asset contract
need to be proven before replacing the current build.

## What Changes

- Add an opt-in Vite build and development server for the current React shell.
- Use a checked TypeScript/JSX entry to exercise the existing client TypeScript
  support through Vite's development and production paths.
- Preserve the existing Webpack scripts as the default while the prototype is
  evaluated.
- Document parity checks for styles, module discovery, assets, backend
  templates, and the mixed Angular/React routes that remain.

## Capabilities

### Modified Capabilities

- `developer-tooling`: Developers can build and serve the React shell with an
  opt-in Vite command while Webpack remains available.

## Impact

This affects client build configuration, package scripts and the backend
development asset connection. It does not intentionally change rendered
behaviour, stored data, APIs, or production deployment. No production switch
should occur until the prototype demonstrates equivalent output.
