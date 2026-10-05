## Why

Administrators currently leave a member report to inspect the member's public
profile, and role changes rely on browser-native confirmation prompts. Keeping
the profile and review actions together will make moderation easier to inspect
and let administrators confirm changes with accessible, informative controls.

## What Changes

- Show the reported member's public profile beneath the existing moderation
  report content on `/admin/user/<username>`.
- Reuse the existing profile view and profile API so profile fields, rendering,
  and visibility checks remain consistent with member-facing profile pages.
- Pass the signed-in administrator as the profile viewer and the reported
  username as the viewed member.
- Replace native confirmation prompts for suspension, shadow banning,
  unshadowbanning, role changes, and greeter changes with application modals
  that preserve cancel and confirm behaviour and provide focus, keyboard,
  progress, and error feedback.
- Keep the member name, moderation buttons, and greeter role labels in their
  current header and action layout.

## Capabilities

### Modified Capabilities

- `admin-moderation`: reports include the public profile and role changes use
  accessible in-app confirmation.

## Impact

This affects the admin member report, profile view composition, React route
context, and admin client tests. Existing profile APIs and authorisation rules
remain the source of profile data and access decisions. No API contract,
database schema, or deployment configuration changes are required.
