# Sort and normalise admin member searches

## Why

The administration member-search table currently preserves the API response
order, making it difficult to compare results by member details or signup date.
Searches that include accidental leading or trailing whitespace are also sent
unchanged, which can produce surprising empty results.

## What Changes

- Make every column in the administration member-search results table sortable
  in ascending and descending order.
- Trim leading and trailing whitespace from member-search queries before they
  are validated, stored in the search URL, or sent to the API.
- Apply the same query normalisation in the API so direct callers receive the
  expected behaviour.

## Impact

- Affects the admin search client component, results table, and users API.
- No data migration, deployment configuration, or breaking API change is
  required.
