## Why

Desktop members need quick access to their own circles and member name search from the header.

## What Changes

- Show up to ten of the signed-in member's circles on desktop hover or keyboard focus, with Hackers first when joined and the remainder ordered by descending member count.
- Show “Find member by name” beneath Search on desktop hover or keyboard focus.
- Preserve primary link destinations and mobile navigation.

## Impact

Affected modules: core client navigation, header styles and navigation tests. Loads circle labels and counts from the existing memberships endpoint, refreshing after membership changes. Uses existing routes; no API, data migration or deployment changes. If memberships cannot be loaded, the primary Circles link remains available.
