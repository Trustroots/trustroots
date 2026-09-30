# Development setup

## Requirements

Use [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) to select the
Node.js version specified in `.nvmrc`:

```sh
nvm use
```

The project uses npm 11. Install the pinned version and the project dependencies:

```sh
npm install --global npm@11.19.0
npm ci
```

On macOS, install these native dependencies before installing the project
packages:

```sh
brew install pkg-config cairo pango libpng jpeg giflib librsvg python-setuptools
```

The `mmmagic` package expects a `python` command. If your system only provides
`python3`, create a symlink:

```sh
ln -s "$(brew --prefix)/bin/python"{3,}
```

## Run locally

Choose the setup that fits your work:

- **Host:** run `nvm use && npm start`.
- **Docker:** run `cd deploy/docker && docker compose up`.
- **Dev container:** reopen the repository with **Dev Containers: Reopen in
  Container**, then run `npm start` in the integrated terminal.

The host and Docker setups serve the app at http://localhost:3000.

Mailpit captures development emails when using Docker Compose or the dev
container. Its web UI is available at http://localhost:1080 with Docker Compose
and http://localhost:11080 in the dev container. Bare `npm start` uses an
in-process JSON transport and does not start the Mailpit UI.

For Docker setup, troubleshooting, dependency rebuilds, and test workflows, see
the [Docker guide](../deploy/docker/README.md). For editor and test workflow
details, see the [dev container guide](../.devcontainer/README.md).
