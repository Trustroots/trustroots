# Retire historical spam cleanup

## Why

The historical spam campaign cleanup is complete, so administrators and operators no longer need the temporary tools for it.

## What Changes

Remove the administrator cleanup page and API, the maintenance command, and the spam filter in administrator member searches.

## Impact

- Admin and users modules lose the historical cleanup workflow. Admin member searches show all matching accounts.
- The shell no longer registers the cleanup page. Operators can no longer run the historical cleanup command.
- Deployment requires no data migration. Existing audit records remain available.
