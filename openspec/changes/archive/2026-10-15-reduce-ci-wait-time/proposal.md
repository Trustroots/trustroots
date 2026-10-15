# Reduce CI wait time

## Why

Recent successful PR checks take about nine minutes. Full-history checkouts,
uneven test groups and repeated dependency installation add avoidable delays.

## What Changes

- Fetch only comparison history needed for change detection and PR reporting.
- Balance the existing E2E projects without removing tests or serial isolation.
- Record server test file durations and reuse them to balance existing workers,
  with deterministic fallback weights when timing data is unavailable.
- Keep the dev image's pnpm store location consistent during CI execution.

## Impact

Affected areas are CI workflows, test orchestration and the development image.
There is no user-facing behaviour change, data migration or production deployment
requirement. Existing coverage thresholds and failure enforcement remain intact.
Browser E2E additions are unsuitable for infrastructure-only behaviour; existing
E2E runs and focused orchestration tests validate it.
