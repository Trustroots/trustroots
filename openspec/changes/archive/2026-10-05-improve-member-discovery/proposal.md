## Why
Member search is hard to reach from the map and only searches names. Result cards lack context for recognising a member.

## What Changes
- Add a visible member-search link to the map search controls and autofocus the member-search input.
- Extend indexed text search to publicly visible home location, origin and short tagline, retaining relevance ordering and existing visibility/blocking protections.
- Show username, home location, origin and tagline in search results, with a field-specific indication when the query text matches.
- Bound query length, result count, pagination and database execution time; retain the minimum three-character query.

## Impact
Affects search UI and users API/model. Existing array response remains compatible. The single MongoDB text index must be replaced using a targeted maintenance command before deployment; no collection-wide regex or biography search is introduced. Production index rebuilding requires an operator-selected maintenance window; the command changes only the existing text index. Search remains authenticated and excludes private, suspended, shadowbanned and mutually blocked accounts.
