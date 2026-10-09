# Circle member discovery and page polish

## Why

Circle detail pages currently stop after the circle description and membership controls. Members need a concise way to discover people they already know, people who recommend them, and currently active members of the same circle. The existing mobile circle experience provides a useful section order, while the web page also needs responsive controls and its shared footer.

## What changes

- Add a responsive circle hero with consistent membership, member-search, and circle-wiki actions.
- For signed-in circle members, show eligible contacts, recommenders, and other members active within the last month, with no duplicates across sections.
- Add one authenticated endpoint returning all three bounded, deduplicated member groups. Filter circle membership, profile visibility, blocks, and restricted account roles before limiting results.
- Return public profile card fields only, without exposing activity timestamps. Bound database work with query timeouts and install the two discovery indexes through a targeted maintenance command.
- Restore the shared site footer on circle pages.

## Impact

Updates the circles web experience and its requirements, including a member-only endpoint scoped to an existing circle membership.
