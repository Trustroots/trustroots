## Why

The regular iOS offer map already uses shared search controls. Its read-only
result status and marker legend can also use Compose within the native map.

## What Changes

- Render loading, result count, errors and the applicable marker legend in
  Compose above the MapKit viewport.
- Use the native marker colours so the legend matches map annotations.
- Keep the overlay out of gesture hit testing and constrain it to the viewport.

## Capabilities

### Modified Capabilities

- `shared-mobile-build`: the regular iOS offer map uses a shared status and legend.

## Impact

Affects the shared Kotlin map overlay and its iOS host. The iOS host handles
MapKit gestures, search requests, selection and navigation.
