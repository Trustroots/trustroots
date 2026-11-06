## Why

Issue #3521 phases out Gravatar in two stages. Stop new selections now without changing existing members’ images before their retirement approach is agreed.

## What Changes

- Hide Gravatar in photo settings unless it is the member’s current source.
- Reject profile API requests that start or resume using Gravatar.
- Preserve existing Gravatar images, unrelated profile edits and the no-photo signup default.
- Document aggregate counting and the decisions needed for retiring remaining images.

## Capabilities

### Modified Capabilities

- `member-profiles`: Restrict Gravatar to retaining an existing selection.

## Impact

Changes affect users client/server and tests. Older clients can retain their current Gravatar selection but cannot enable it after switching away. No data migration or image changes occur in this stage; avatar serving and privacy disclosures remain until retirement is agreed and completed.

## Additional requested scope

Provide an admin-only `/admin/gravatar` page with a current account count and a
paginated list linking to existing admin member pages. The API returns only
member identifiers, usernames and display names, never email addresses or
hashes. It does not fetch images or migrate accounts.

- `admin-moderation`: Inspect current Gravatar usage before a retirement decision.
