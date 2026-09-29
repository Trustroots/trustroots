# Hide avatars from members who have been blocked

## Why

Blocking hides a member's protected profile when that member blocks the viewer, but the avatar-by-ID endpoint still returns the member's uploaded or remote avatar. That lets a blocked viewer bypass the profile's unavailable state.

## What Changes

- Return the default avatar for a non-admin viewer when the avatar owner has blocked that viewer.
- Preserve avatar access for the blocker, who needs to open the profile and reach the unblock control, and for administrators.
- Add regression coverage for owner, unrelated public member, both block directions, administrator, and signed-out access.

## Affected Modules

- `modules/users` avatar lookup and profile visibility tests
- `openspec/specs/relationships-safety`

## Compatibility

No stored data or migration changes. Public avatars remain available to authenticated members who are not blocked by the profile owner. Existing profile access and unblock behaviour remain unchanged.
