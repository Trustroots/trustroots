# Move member entry pages to React

## Why

Welcome, navigation and member search already use self-contained React
components. Rendering these routes with the existing React shell removes
their Angular bootstrapping without changing the current runtime.

## What Changes

- Render `/welcome`, `/navigation` and `/search/members` in the React shell.
- Preserve sign-in requirements, page titles, footer visibility, query-based
  member searches, sign-out and links into existing member workflows.
- Keep Angular route names as entry points into the corresponding React pages.

## Impact

Updates shared route ownership, client route adapters and regression coverage.
This change targets main independently of the circles migration and PR 2769.
No runtime, dependency or database change is required.
