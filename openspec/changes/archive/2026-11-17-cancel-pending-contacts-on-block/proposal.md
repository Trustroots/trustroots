# Cancel pending contacts on block

## Why

Pending contact requests can outlive a block and still be confirmed from an earlier link. Account removal also needs regression coverage for a pending request sent by the deleted member.

## What changes

- Cancel pending contact requests in either direction when a member blocks another member.
- Reject confirmation of a pending request if either member has blocked the other, including requests that predate this change.
- Verify that deleting an account removes a request sent by that account.

## Impact

The users module invokes contact cleanup through its existing dependency on the contacts module. Existing confirmed contacts and Experience records retain their current lifecycle. This change requires no schema migration.
