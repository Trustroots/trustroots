# Development setup

## Requirements

Use [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) to select the
Node.js version specified in `.nvmrc`:

```sh
nvm use
```

The project uses pnpm, pinned in the `packageManager` field of `package.json`. Enable it with Corepack (or install that version yourself) and install the project dependencies:

```sh
corepack enable
pnpm install --frozen-lockfile
```

On macOS, install these native dependencies before installing the project
packages:

```sh
brew install pkg-config cairo pango libpng jpeg giflib librsvg python-setuptools
```

## Run locally

Choose the setup that fits your work:

- **Host:** run `nvm use && pnpm start`.
- **Docker:** run `cd deploy/docker && docker compose up`.
- **Dev container:** reopen the repository with **Dev Containers: Reopen in
  Container**, then run `pnpm start` in the integrated terminal.

The host and Docker setups serve the app at http://localhost:3000.

Mailpit captures development emails when using Docker Compose or the dev
container. Its web UI is available at http://localhost:1080 with Docker Compose
and http://localhost:11080 in the dev container. Bare `pnpm start` uses an
in-process JSON transport and does not start the Mailpit UI.

For Docker setup, troubleshooting, dependency rebuilds, and test workflows, see
the [Docker guide](../deploy/docker/README.md). For editor and test workflow
details, see the [dev container guide](../.devcontainer/README.md).

## Check internal links

Run `pnpm run check:links` to check literal JSX links against the browser route
registry and fragment IDs in the destination components. CI runs this check and
its regression tests (`pnpm run test:links`) with the client checks.

Use paths starting with `/` for internal navigation. The check follows local
component imports and recognises literal IDs supplied in data objects and the
app shell. It checks source definitions, so browser tests are still needed to
verify scrolling, focus and conditionally rendered targets. It does not check
external website availability, API endpoints or links constructed from runtime
data.
