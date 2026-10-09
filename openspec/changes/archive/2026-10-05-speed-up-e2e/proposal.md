## Why

The full e2e suite serialises feature projects in one CI job and API checks
unnecessarily load the search page. Some password assertions duplicate server
integration coverage.

## What Changes

- Run account/public, community, and admin/search groups on three isolated CI runners.
- Authenticate without navigation and use request-only fixtures for API checks.
- Aggregate all groups before enforcing complete feature coverage.
- Retain all wheel input/zoom/renderer/browser cases, but exercise the repeated
  Search–Circles–Search sequence once per renderer/browser with pixel input at
  zoom 6. No wheel test is removed. Keep identical composer assertions in
  Chromium and Firefox because they cover different browser engines.
- Remove only `members can change their password with validation`: retain its
  missing-current-password assertion in server route tests; successful changes
  and sensitive-field filtering already have coverage there. Extend the retained
  browser password journey with visible validation before changing credentials.

## Capabilities

### New Capabilities

- `e2e-orchestration`: Isolated test groups with complete aggregate reporting.

## Impact

Changes CI and the test harness only. No public application API, migration or
production deployment change. Default local runs still execute the full suite.
Required feature scenarios and client/server coverage thresholds remain unchanged.
