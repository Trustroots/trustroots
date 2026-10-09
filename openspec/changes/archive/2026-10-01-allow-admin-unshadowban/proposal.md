# Allow administrators to unshadowban members

## Why

Administrators can apply a shadowban from the member report, but cannot remove it there. Restoring a member currently requires a database change or switching to another restriction.

## What changes

- Add an Unshadowban action to shadowbanned member reports in `/admin`.
- Allow administrators to remove the `shadowban` role through the existing role-change API, with a moderation note and audit entry.
- Messages hidden when sent remain hidden after the role is removed.

## Impact

Affected areas: administrator member reports, role-change API, and moderation tests. The existing API gains one permitted role/action combination. No data migration or deployment change is required.
