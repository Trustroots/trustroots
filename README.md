<p align="center">
  <br>
  <br>
  <a href="https://www.trustroots.org/"><img width="150" src="https://cdn.rawgit.com/Trustroots/trustroots/master/public/img/logo/color.svg" alt="Trustroots"></a>
  <br>
  <br>
  <em>Travellers' community. Sharing, hosting and getting people together.</em>
  <br>
  <br>
</p>

## Maintenance mode

Trustroots is in maintenance mode. No new features are being developed. Our
medium term plan is decentralisation, more on that will be published soon.

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
- Photos copyright [photographers](https://github.com/Trustroots/trustroots/blob/master/modules/core/client/directives/tr-boards.client.directive.js#L30) - several of them are under Creative Commons. Others are permitted to use only with Trustroots.
- Logos of external communities are copyrighted work and may be subject to trademark laws.
