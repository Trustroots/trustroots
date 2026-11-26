## Why

The regular iOS offer map already shows its status and legend in Compose.
The two map actions can use shared button presentation and accessibility.

## What Changes

- Display Search filters and Use current location as Compose actions with
  44-point hit targets.
- Reuse each native SF Symbol and the current map action colours.
- Route taps to the existing iOS filter sheet and location manager.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: the regular iOS offer map uses shared map actions.

## Impact

Affects shared Kotlin UI and the iOS map overlay. The native host handles
MapKit gestures, filter selection, location permissions and error reporting.
