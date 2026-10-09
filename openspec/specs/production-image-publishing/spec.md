# Production image publishing

## Purpose

Build and publish traceable production images from trusted main commits while validating pull request builds without publishing privileges.

## Requirements

### Requirement: Publish production container images from trusted main builds

GitHub Actions SHALL build the production container image for `linux/amd64`
and publish it to `ghcr.io/trustrootsops/trustroots` after a push to `main`.
The image SHALL carry the full source commit, commit timestamp and branch as
build metadata, and SHALL be published with `latest` and `git-<short-commit>`
tags. Pull request builds SHALL validate the production image without
publishing it or receiving package write permission.

#### Scenario: Main branch push

- **WHEN** a code-bearing commit is pushed to `main`
- **THEN** CI builds the production image for `linux/amd64`
- **AND** CI publishes `latest` and `git-<short-commit>` tags to GHCR
- **AND** the image metadata identifies the full commit, commit timestamp and
  `main` branch

#### Scenario: Pull request validation

- **WHEN** a pull request runs the production image build
- **THEN** CI validates the image build without publishing tags
- **AND** the job does not receive package write permission
