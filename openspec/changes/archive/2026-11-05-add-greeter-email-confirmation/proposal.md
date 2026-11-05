## Why

Greeters reviewing acquisition stories cannot see whether a new member has confirmed their email or help them replace an expired confirmation link.

## What Changes

- Add a labelled email confirmation column to acquisition stories.
- Allow welcome-team, support-team and administrators to resend signup confirmation for unverified accounts from the member row.
- Issue a fresh 24-hour link without activating the profile, exposing addresses in the list, or changing established accounts' pending email changes.

## Capabilities

### Modified Capabilities

- `admin-moderation`: Show confirmation status and allow staff-assisted signup confirmation reissue.

## Impact

Admin module API, policy, client and tests; existing users token and core mail helpers. Status is derived from existing account fields and requires no migration. New endpoint is additive and audited. Existing module dependencies are reused.
