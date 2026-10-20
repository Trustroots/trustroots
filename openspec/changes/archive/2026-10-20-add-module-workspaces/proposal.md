# Module workspace tooling

## Why

Feature modules need manifests that reflect their existing dependencies and a convenient way to run checks for affected modules during development.

## What Changes

- Represent feature modules as private source-only pnpm workspace packages.
- Generate and validate manifests against the module graph baseline.
- Provide affected lint and client tests through Turborepo while retaining full CI checks and coverage enforcement.
- Preserve production dependency pruning with workspace manifests available in the image build.

## Impact

Developer tooling and production image dependency installation; no application behaviour changes.
