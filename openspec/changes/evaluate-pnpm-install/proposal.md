## Why

The repository currently uses npm 11 and Node.js 24. The original case for
changing package managers includes assumptions that are no longer current, so
the decision should be based on measured clean and repeat installs and on
container compatibility.

## What Changes

- Add a repeatable package-manager comparison that records cold and warm
  installs for npm and pnpm using the same checkout and runtime.
- Record the strict-resolution and native-dependency checks required before a
  package-manager switch is proposed.
- Keep npm as the supported package manager until measurements and container
  checks justify a separate migration proposal.

## Capabilities

### Modified Capabilities

- `developer-tooling`: Maintainers can collect comparable package installation
  measurements before choosing a package manager.

## Impact

This affects developer tooling and package-manager evaluation documentation.
It does not replace the lockfile, change CI or deployment installation, or
alter runtime behaviour. No production migration or data migration is needed.
