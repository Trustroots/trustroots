## Why

Android profile experiences run responses into the original feedback and omit available recommendation and hosting context. Issue #3683 asks for clearer ownership and readable spacing.

## What Changes

- Render experience feedback and profile-owner responses in separate rounded surfaces, with a bold named response heading.
- Show guest/host interaction labels and recommendation text alongside theme-aware sentiment colours. Unknown or absent answers remain neutral.
- Extend the existing API parser without changing server data, visibility or navigation.

## Impact

Affected: Android profile UI, API parsing and native journey coverage. No migration, dependency or server change. Existing profile author actions stay intact.
