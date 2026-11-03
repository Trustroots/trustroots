# Sort spam cleanup review and avoid empty-stage selection

## Why

After Stage 1 is cleared, a fresh preview still selects that empty stage and disables every remaining Stage 2 checkbox. Administrators also need to sort the full review by its displayed columns.

## What Changes

- Split no-recorded-login accounts into their own stage, separate from recent logins. Default to the first non-empty eligible stage and keep selection and deletion confirmation explicit. Recheck missing login immediately before deletion so newly recorded logins are retained.
- Add ascending and descending sorting for selection, account, creation date, last recorded login, stage and decision across the whole preview, retaining selections across sorting and pagination.
- Store review rows and no-login IDs in bounded snapshot chunks and require a fresh preview after the storage format changes. Keep account activity protections unchanged.

## Impact

Admin client, preview API and storage, operator documentation and client, server and browser tests. No module dependencies change. Existing previews expire and must be regenerated after deployment.
