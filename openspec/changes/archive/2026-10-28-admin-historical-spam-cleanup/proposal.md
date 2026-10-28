# Administrator historical spam cleanup

## Why

The existing maintenance command requires terminal access. Administrators need a reviewed way to run the same fixed account-cleanup criteria.

## What Changes

Add an admin-only Spam account cleanup page with bounded previews, linked candidate accounts, eligible/protected counts and explicit deletion of the reviewed batch. Server previews expire and bind the batch to its administrator. Apply rechecks existing eligibility and protected activity. Audit identifiers and counts only. Keep the CLI and campaign criteria unchanged. No cleanup runs automatically.

## Impact

Admin routes/client navigation, users cleanup service and tests. No external dependencies or live data migration. Use batches of at most 100 accounts to keep requests bounded.
