## Why

Thread inspection exposes database identifiers and raw records instead of a readable conversation overview.

## What Changes

- Use username links and accept legacy identifier links by resolving them to usernames.
- Remove the member input and raw thread details.
- Show participants, read status, directional votes and actual first/last message timestamps in a table, using UTC yyyy-mm-dd hh:mm dates.

- Unify administration datetimes, support member context and username-based account links.
- Use the standard read-only conversation display without the manual query and recipient warning controls.

## Impact

- Admin thread API aggregation and types, member links and message-link parsing.
- Client, API and browser tests. Existing admin permissions remain in force.
