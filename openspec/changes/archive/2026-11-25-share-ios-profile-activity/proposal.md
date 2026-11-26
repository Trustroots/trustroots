## Why

Move the regular iOS profile activity and location sections into Compose so they
can share presentation with the mobile apps.

## What Changes

- Show last login, reply rate and available reply time in Compose.
- Show the member's available locations as actions that open the native search map.
- Reuse content-height measurement inside the profile scroll view.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: the regular iOS profile shares activity and location presentation.

## Impact

The shared Kotlin UI and iOS presentation change. No API or data migration is required.
