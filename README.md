<p align="center">
  <br>
  <br>
  <a href="https://www.trustroots.org/"><img width="150" src="https://cdn.rawgit.com/Trustroots/trustroots/main/public/img/logo/color.svg" alt="Trustroots"></a>
  <br>
  <br>
  <em>Travellers' community. Sharing, hosting and getting people together.</em>
  <br>
  <br>
</p>

## Current development

[![Tests](https://github.com/Trustroots/trustroots/actions/workflows/test.yml/badge.svg)](https://team.trustroots.org/coverage/)

_Out of maintenance mode_

As of June 2026, Trustroots is no longer in maintenance mode. The project was mostly in maintenance mode from 2022 until June 2026, and development work is welcome again.

Priorities:

- Simplify old code and reduce duplication.
- Upgrade dependencies and improve the development setup, including Docker.
- Continue the React transition where it makes sense.
- Work on Nostr/Nostroots integration. The basics are in place for NIP-5 and NIP-7.
- Make Trustroots easier to fork and run independently.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines and tests. See [team.trustroots.org](https://team.trustroots.org/) for more ways to help.

## Medium term plans

Our medium term plan is decentralisation through the Nostr protocol. See https://github.com/Trustroots/nostroots.

We are also open to improvements that [make trustroots forkable](https://github.com/Trustroots/trustroots/issues/2669).

## nvm & npm

We're using [nvm](https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating) to manage the supported Node.js 24 runtime. Node.js 24 includes the supported npm 11 release.

- `nvm install`
- `nvm use`
- `npm ci`

To be able to install dependencies on macOS / apple silicon, the following dependencies are required:

- `brew install pkg-config cairo pango libpng jpeg giflib librsvg python-setuptools`

## Running locally

Choose the setup that fits what you're doing:

- Host development: `nvm use && npm start`
- Docker development: `cd deploy/docker && docker compose up`
- Dev container: open the repository with **Dev Containers: Reopen in Container**
  and run `npm start` inside the integrated terminal

The host and Docker setups serve the app at http://localhost:3000.

MailDev (catch outbound mail in development) runs only via Docker Compose or
the Dev Container, at http://localhost:1080 (SMTP on port 1025). Bare
`npm start` on the host does not start MailDev — use
`cd deploy/docker && docker compose up` (or the Dev Container) when you need
the mail UI.

Docker dev uses hot reload, MailDev, and a shared MongoDB service. See
[`deploy/docker/README.md`](deploy/docker/README.md) for first-time setup,
troubleshooting, dependency rebuilds, test workflows, and production-like image
checks. See [`.devcontainer/README.md`](.devcontainer/README.md) for editor and
test workflow details.

## Building for production

See `deploy/docker`. Run `dockerBuild.sh`. Then `docker push` the latest tags
which are output as the last part of the `dockerBuild.sh` script.

## Merging

Only use `git merge --no-ff branch` or the "Create a merge commit" option on
GitHub. We don't want to delete any commit hashes. No rebasing or squashing.

We use the commit hash to track what was deployed when, so any of those
operations can destroy that history, making it much harder to understand what
code was deployed when in the past.

## License

- [The AGPL Licence](LICENSE.md)
- Photos copyright [photographers](https://github.com/Trustroots/trustroots/blob/main/modules/core/client/directives/tr-boards.client.directive.js#L30) - several of them are under Creative Commons. Others are permitted to use only with Trustroots.
- Logos of external communities are copyrighted work and may be subject to trademark laws.
