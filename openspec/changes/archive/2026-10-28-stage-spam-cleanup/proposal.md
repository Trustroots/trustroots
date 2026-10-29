# Prioritise inactive campaign accounts and accelerate scanning

## Why

Scanning hundreds of thousands of accounts in 100-account requests is slow. Administrators need a stage overview to prioritise inactive accounts before considering less certain records.

## What Changes

Use internal scan/deletion chunks of 1,000 accounts while keeping the review table at 100 rows per page. Do not fetch review details while scanning. Show overview counts for eligible accounts last seen before 1 January 2024 UTC, eligible accounts needing review (recent or unrecorded login), and protected accounts. Default selection to the inactive stage; preserve global selection and exclusions within each stage. Apply rechecks the inactivity cutoff as well as all existing activity protections. New previews are required after deployment; existing snapshots expire without deletion.

## Impact

Users cleanup service, admin preview storage/API/UI, tests and operator documentation. The CLI and fixed campaign criteria remain unchanged. No live cleanup is run automatically.
