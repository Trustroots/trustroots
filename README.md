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

[![Tests](https://github.com/Trustroots/trustroots/actions/workflows/test.yml/badge.svg)](https://github.com/Trustroots/trustroots/actions/workflows/test.yml)

_Out of maintenance mode_

As of June 2026, Trustroots is no longer in maintenance mode. The project was mostly in maintenance mode from 2022 until June 2026, and development work is welcome again.

Priorities:

- Simplify old code and reduce duplication.
- Upgrade dependencies and improve the development setup, including Docker.
- Continue the React transition where it makes sense.
- Work on Nostr/Nostroots integration. The basics are in place for NIP-5 and NIP-7.
- Make Trustroots easier to fork and run independently.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines and tests. See [docs/Volunteering.md](docs/Volunteering.md) for more ways to help.

## Medium term plans

Our medium term plan is decentralisation through the Nostr protocol. See https://github.com/Trustroots/nostroots.

We are also open to improvements that [make trustroots forkable](https://github.com/Trustroots/trustroots/issues/2669).

## nvm & npm

We're using [nvm](https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating) to manage node versions.

- `nvm use`
- `npm -g i npm@latest-7 node-gyp@0.8.0`

It's important to use the latest version of npm v7 and not later.

To be able to install dependencies on macOS / apple silicon, the following dependencies are required:

- `brew install pkg-config cairo pango libpng jpeg giflib librsvg python-setuptools`

Installing mmmagic expects `python` to be a valid binary, which it is not. This can be solved by adding a symlink from `python` to `python3` like so:

- `ln -s "$(brew --prefix)/bin/python"{3,}`

If you're running on apple silicon, you also need to run this command:

- `sed -i '' 's/"rU"/"r"/' ~/.nvm/versions/node/v16.20.2/lib/node_modules/npm/node_modules/node-gyp/gyp/pylib/gyp/input.py`

You might also need to run the linux equivalent of that if you see an error about "ValueError: invalid mode: 'rU' while trying to load binding.gyp". The linux equivalent removes the first set of `''`.

## Running locally

Choose the setup that fits what you're doing:

- Host development: `nvm use && npm start`
- Docker development: `cd deploy/docker && docker compose up`
- Dev container: open the repository with **Dev Containers: Reopen in Container**
  and run `npm start` inside the integrated terminal

The host and Docker setups serve the app at http://localhost:3000. Docker also
starts MailDev at http://localhost:1080.

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

- [The AGPL License](LICENSE.md)
- Photos copyright [photographers](https://github.com/Trustroots/trustroots/blob/main/modules/core/client/directives/tr-boards.client.directive.js#L30) - several of them are under Creative Commons. Others are permitted to use only with Trustroots.
- Logos of external communities are copyrighted work and may be subject to trademark laws.
