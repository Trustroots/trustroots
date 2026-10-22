## Why

Issue #3232 asks whether shared Kotlin and Compose UI can reduce mobile
maintenance effort. Both native apps already work. Assess reuse and define
an incremental migration before changing their architecture.

## What Changes

- Add a source-level comparison of separate apps, shared logic with native UI,
  and shared logic with Compose UI.
- Document shared code in the existing Android app and Compose journeys embedded
  in the existing SwiftUI app, reusing native secure stores.
- Plan real-API sign-in, profile, inbox, conversation and reply as the first
  milestone, with acceptance gates, effort estimates and rollback boundaries.
- Identify compatibility gaps and evidence needed from later builds and devices.

## Capabilities

### Added Capabilities

- `compose-mobile-evaluation`: evidence and decision criteria for phased
  migration of the existing apps.

## Impact

This first PR changes documentation only. No app code, dependencies, build
settings, server contracts, data or release behaviour change. No migration or
deployment is required. Subsequent implementation needs validated spec deltas;
this report does not satisfy the issue's working-build completion criterion.
