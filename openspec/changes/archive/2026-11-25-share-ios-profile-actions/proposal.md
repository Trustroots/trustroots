## Why

Move the regular iOS profile actions into Compose as part of the shared
profile migration.

## What Changes

- Render edit, hosting and message controls in Compose.
- Render report, block and unblock controls and their feedback in Compose.
- Keep the iOS routes, confirmation dialogs, account checks and authenticated requests.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: the iOS profile shares its member actions.

## Impact

This changes the iOS profile presentation. The mobile API and block rules remain in use.
