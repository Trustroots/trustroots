## Why

Administrators need to see when accounts with Gravatar configured last used Trustroots and find them by name or activity across the full report.

## What Changes

- Show each listed account’s recorded last-seen time in UTC.
- Allow ascending and descending sorting by username, display name and last-seen time across all pages.
- Show profile pictures beside usernames using the existing authenticated avatar endpoint.

## Capabilities

### Modified Capabilities

- `admin-moderation`: Include last-seen timestamps and sorting in Gravatar usage inspection.

## Impact

The admin Gravatar page and API gain an optional sort and expose the existing last-seen timestamp to administrators. Requests without a sort retain the existing order.
