## Why

Support volunteers need to identify and follow up profiles that need moderation attention (issue #3519). The requested role name is `flagged`.

## What Changes

- Add an internal `flagged` role which grants no permissions and does not restrict accounts.
- Allow support-team members and administrators to add/remove the flag through a narrowly scoped API and the existing support/admin profile views.
- Show a labelled warning badge internally and a paginated flagged-member list available to support staff.
- Hide the flag from public profiles and the member’s own client bootstrap.
- Audit flag changes without recording private profile content.

## Capabilities

### Modified Capabilities

- `admin-moderation`: Add, remove and find internal follow-up flags.

## Impact

The users model, core bootstrap and admin client/API change. No existing accounts are flagged or migrated automatically. Existing permission checks and access restrictions remain unchanged; support staff gain only flag management and listing, not broader role management.
