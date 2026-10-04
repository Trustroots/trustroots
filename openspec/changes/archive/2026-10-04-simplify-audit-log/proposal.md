# Simplify the audit log and filter staff activity

## Why

Large request JSON panels make the audit log difficult to scan. Administrators
need to focus on activity by a particular staff username or team.

## What Changes

- Replace expanded panels with compact rows and expandable request details.
- Summarise non-empty request fields without pagination noise.
- Filter by the acting staff username and current admin/welcome-team membership.
- Apply filters before selecting the latest 100 matching entries, and offer
  usernames from all recorded actors rather than only the current result set.

## Impact

The existing audit endpoint retains its array response and accepts optional
username and team query parameters. An admin-only actor-options endpoint is
added. Existing logging and raw stored details remain unchanged. No migration.
