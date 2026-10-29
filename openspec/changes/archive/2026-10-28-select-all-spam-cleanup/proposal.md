# Whole-preview spam account selection

## Why

Administrators need to clean all eligible campaign accounts in one operation and exclude individual accounts, without manually applying 100-account batches.

## What Changes

Build a full server-side preview incrementally in bounded requests, storing reviewed IDs in separate chunks. Display a paginated account list with global Select all/Clear selection and persistent individual selections. One explicit confirmation applies the selection across all chunks automatically, with progress, rechecks and recorded results. No fixed limit on the number of accounts in a cleanup. Closing the page stops further requests; interrupted operations fail closed and require a fresh preview.

## Impact

Admin cleanup preview storage, APIs, interface and tests. The CLI, fixed campaign scope, permissions, protected-activity rules and identifier/count-only audit logging remain unchanged.
