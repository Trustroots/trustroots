# Change: Restrict the Naturists circle to signed-in members

## Why

The Naturists circle contains community context that should not be discoverable
by anonymous visitors or search engines. Existing non-public circles are hidden
from everyone, so they cannot express a circle that remains available to
signed-in members.

## What Changes

- Treat the `naturists` circle slug as member-only.
- Omit member-only circles from catalogue responses for anonymous visitors.
- Refuse anonymous detail requests for a member-only circle.
- Require authentication for the Naturists circle browser route.
- Preserve ordinary public-circle access and existing non-public-circle
  behaviour.

## Impact

- Affected capability: `circles`
- Affected code: circle API filtering, circle client routing, and end-to-end
  fixtures and coverage
