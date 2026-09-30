<p align="center">
  <br>
  <br>
  <a href="https://www.trustroots.org/"><img width="150" src="docs/assets/trustroots-logo-white-bg.svg" alt="Trustroots"></a>
  <br>
  <br>
  <em>Travellers' community. Sharing, hosting and getting people together.</em>
  <br>
  <br>
</p>

## Android preview

[![Download Android APK](https://img.shields.io/github/v/release/Trustroots/trustroots?include_prereleases&sort=date&filter=Android%20preview%20%2A&display_name=release&label=Download%20Android%20APK&logo=android)](https://github.com/Trustroots/trustroots/releases)

Download the latest signed Android APK from [GitHub Releases](https://github.com/Trustroots/trustroots/releases). The badge updates automatically when a new Android preview is published after a successful build on `main`.

## Current development

[![Tests](https://github.com/Trustroots/trustroots/actions/workflows/test.yml/badge.svg)](https://team.trustroots.org/coverage/)

Trustroots is actively developed again. After a period focused mainly on
maintenance from 2022 to June 2026, we welcome contributions and improvements.

Current areas of work include:

- Simplifying older code and reducing duplication.
- Improving the development setup and updating dependencies.
- Continuing the move to React and TypeScript where it makes sense.
- Developing the Nostr/Nostroots integration.
- Making Trustroots easier to run independently and adapt for forks.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines and tests,
and [team.trustroots.org](https://team.trustroots.org/) for more ways to help.

## Medium term plans

Our medium term plan is decentralisation through the Nostr protocol. See https://github.com/Trustroots/nostroots.

We are also open to improvements that [make trustroots forkable](https://github.com/Trustroots/trustroots/issues/2669).

## Development setup

See the [development setup guide](docs/development.md) for prerequisites and
instructions for running Trustroots locally.

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
