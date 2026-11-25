## Why

The regular iOS Contacts screen already uses Compose. Reuse its contact rows
in the regular profile so both places display the same member identity UI.

## What Changes

- Render profile contacts with shared rows and the existing iOS avatars.
- Keep the first six contacts visible by default, with controls to expand and collapse.
- Route selectable rows to the native profile destination, including from My profile.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: the iOS profile reuses shared contact rows.

## Impact

The iOS presentation, navigation and shared Compose UI change. No API or data changes are required.
