## Why

Administrators need a quick way to review recent username changes when
investigating member reports and account activity.

## What Changes

- Record each future successful username change as an old/new username pair
  with its timestamp, visible only to administrators.
- Add an admin-only page that defaults to username changes from the previous
  90 days and offers an all-time view.
- Show the member's current username as a link to their admin report, optional
  display name, old and new usernames, and the exact UTC change timestamp.
- Return results 50 at a time, newest first, with stable member ID tie-breaking.

Existing `usernameUpdated` timestamps remain available for pre-feature changes,
but their previous username is unknown. The view will mark that information as
unavailable and will not invent prior names.

## Impact

- Adds an admin API and page, with tests for access control, date filtering,
  pagination, ordering and navigation.
- Adds a private member history field written atomically with a successful
  rename, and uses the existing admin authorisation.
