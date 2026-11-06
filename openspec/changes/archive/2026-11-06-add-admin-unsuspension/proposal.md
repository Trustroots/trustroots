## Why

Issue #3544 requests an explicit, reasoned administrator action to restore access after reviewing a suspension.

## What Changes

- Add Unsuspend to suspended members’ admin reports, with confirmation and a required administrator reason.
- Add an administrator-only endpoint, separate from generic role changes, that removes only `suspended`.
- Preserve other roles, subscriptions, profile visibility and member data; sign-in remains subject to remaining restrictions.
- Persist the administrator, member, reason and timestamp in audit history and refresh the report after success.
- Make repeated requests safe and reject stale role/authentication snapshots.

## Capabilities

### Modified Capabilities

- `admin-moderation`: Confirm, audit and perform member unsuspension.

## Impact

Changes affect admin client/API and tests. Existing accounts need no migration. MongoDB 4.4/7.0 standalone compatibility is retained; no transactions are required. Audit intent is saved before changing roles, so audit storage failure prevents a change. An atomic compare-and-set checks the observed roles and authentication version, removes only suspension and increments the version once. Audit outcome is then recorded as unsuspended or conflict. If recording that outcome fails, the original audit intent remains and the API instructs the administrator to refresh before retrying.
