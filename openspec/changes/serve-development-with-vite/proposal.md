# Serve development with Vite

## Why

The Vite production bundle is now what CI end-to-end tests build, and that suite
is green. Local development still starts Webpack, so the path developers use
every day is not the path CI verifies.

## What Changes

- `pnpm start` and `pnpm start:docker` serve the React shell with the Vite
  development server and set `TRUSTROOTS_VITE_DEV_SERVER` so Express renders
  the Vite client.
- `pnpm start:webpack` keeps the previous Webpack development server.
- The Vite development server listens on the same `config.host` value Webpack
  uses.

## Affected modules

- `package.json` development scripts
- `vite.config.mjs`
- developer documentation for local Docker and the dev container

## Compatibility and deployment

No member-facing behaviour, stored data, or API changes. This change does not
by itself switch the production image. No data migration.
