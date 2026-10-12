## Why

Production image builds currently require a maintainer to run
`deploy/docker/dockerBuild.sh` locally and push the resulting images. Publishing
from the trusted `main` branch in GitHub Actions makes the release image
available consistently while keeping pull request builds safe.

## What Changes

- Build the production image for `linux/amd64` in GitHub Actions.
- Pass the full commit, commit timestamp and branch as image build metadata.
- Publish `latest` and `git-<short-commit>` tags to GHCR after pushes to `main`.
- Keep pull request builds validation-only; do not publish their images.

## Impact

The production-image CI job and its GHCR package permissions are affected.
Published tags and image metadata match the existing local build script. No
application behaviour, stored data or deployment configuration changes; no
database migration is required. Publishing uses the repository's
`GITHUB_TOKEN`, and only trusted pushes to `main` receive package write access.
