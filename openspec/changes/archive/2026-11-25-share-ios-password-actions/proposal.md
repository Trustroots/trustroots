## Why

Move the regular iOS Account password actions and feedback to the shared Compose UI as part of #3232.

## What Changes

- Render Change password, the recovery link and feedback in Compose.
- Use the existing Swift secure fields and authenticated password update.
- Open the same iOS password-recovery browser route from the Compose action.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: the iOS Account password actions use shared Compose.

## Impact

The iOS Account presentation and shared UI change. No API or credential storage changes are required.
