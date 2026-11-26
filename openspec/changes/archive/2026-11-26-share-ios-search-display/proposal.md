# Change: Share the iOS Search display selector

## Why

The regular iOS Search screen uses a native picker to switch between Map, Results and Members. Move that choice into shared Compose while preserving the existing map, offer and member destinations.

## What changes

- Render the Map, Results and Members selector in shared Compose.
- Keep the selected display, map camera, filters and navigation in the iOS host.
- Verify the destination switches and preserved member query in the iOS Search journey.

## Impact

- Affected spec: shared-mobile-build
- Affected code: shared Compose Search presentation and the regular iOS Search screen
