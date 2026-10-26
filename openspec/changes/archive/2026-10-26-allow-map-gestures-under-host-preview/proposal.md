## Why

The Android host preview currently dims the map and blocks all input while it is
open. Members should be able to pan and zoom the retained map without closing
the preview, then continue using the preview's close and profile actions.

## What Changes

- Allow map gestures through the visual host-detail scrim while keeping the
  host card and its controls interactive.
- Preserve profile navigation and Back behaviour from the host preview.
- Add an Android journey that pans the map with the preview open, then opens a
  profile and verifies Back returns to the map.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: specify map gesture access while HostDetail is
  open above the retained map.

## Impact

- Android Search overlay scene and host-map instrumentation.
- No API, data migration, dependency, web or iOS changes.
