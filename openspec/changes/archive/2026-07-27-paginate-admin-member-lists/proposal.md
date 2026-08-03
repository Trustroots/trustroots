# Paginate administration member lists

## Why

Administration searches and role filters stop at 150 members. That hides
additional matching members and makes large role lists difficult to review.
Sorting is currently applied only to the loaded result set, so it cannot give a
reliable order across a complete large result.

## What Changes

- Return paginated member-search, role-filter, and current-IP lookup results.
- Let administrators choose each supported member-table column and direction as
  the server-side order for every page.
- Reuse one member-list query path and one client results-table pagination
  control across the administration views that show member collections.

## Impact

- Affects admin member-list APIs, their client callers, results table, and
  client, server, and end-to-end tests.
- No migration or new member data is required.
