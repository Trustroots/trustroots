## Why

Move the regular iOS Account overview presentation to Compose as part of #3232.

## What Changes

- Render the Account heading and the signing and sign-out entry points in shared Compose.
- Keep the loading indicator, signing sheet route and session sign-out operation with the iOS host.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: regular iOS Account uses shared Compose for its heading and top-level actions.

## Impact

The iOS Account presentation and shared UI change. Account loading, signing authorization and session handling continue to use their current iOS owners.
