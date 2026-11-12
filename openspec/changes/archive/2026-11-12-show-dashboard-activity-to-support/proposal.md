## Why

Support team members need the recent activity overview when monitoring member activity.

## What Changes

- Let support team members open `/admin` and view the three recent activity panes through the dashboard API.
- Link to the dashboard from support navigation and keep administrator-only tools behind their existing permissions.

## Capabilities

### Modified Capabilities

- `admin-moderation`: Extend read access to the dashboard activity panes to support team members.

## Impact

Updates admin dashboard rendering and API permissions, plus the shared route policy. No data migration is required.
