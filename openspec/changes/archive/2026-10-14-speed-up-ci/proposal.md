## Why

The PR overview records test durations but hides setup, image and build costs.
Lint repeats the same scan, client checks wait for a browser-equipped Docker
image, and all three end-to-end groups build identical client assets.

## What Changes

- Add job and step timing snapshots to the PR and HTML coverage overviews,
  with log links and separate elapsed and accumulated job durations.
- Reuse one ESLint result for annotations and enforcement.
- Run existing client checks directly on Node 24 with cached pnpm dependencies.
- Build end-to-end assets once and distribute them to the existing groups.

## Impact

Only developer tooling and CI reporting change. Application behaviour, test
discovery and coverage requirements remain unchanged. No data migration or
deployment changes are required. CI integration checks and reporting unit tests
are appropriate here; application end-to-end tests cannot exercise GitHub Actions.
