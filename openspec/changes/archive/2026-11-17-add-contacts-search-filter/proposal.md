# Add a connections filter to search

## Why

Members need to find people they know by location or profile details regardless of hosting availability (issue #2629).

## What changes

- Add a connections-only filter to web map search and member search.
- Include confirmed contacts and members with a positive Experience in either direction.
- Exclude a member if either direction has a visible negative Experience, even if they are a confirmed contact.
- Keep offer location and Experience visibility rules in both search flows.

## Impact

Search controls and existing authenticated search endpoints gain an optional filter. No new location or relationship data is collected.
