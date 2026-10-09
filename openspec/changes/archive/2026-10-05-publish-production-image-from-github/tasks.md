## Implementation

- [x] Validate the proposal structure and affected CI/specification scope
      before implementation. The OpenSpec CLI was unavailable in this
      environment.
- [x] Update the production-image GitHub Actions job to publish the amd64 image
      with the local script's metadata and tags on pushes to `main`.
- [x] Keep pull request image builds non-publishing and without package write
      permission.
- [x] Review workflow syntax and its event and permission gates against the
      existing GitHub Actions format.
- [x] Archive the change and update the living specification.
