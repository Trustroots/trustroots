## Why

Travellers need to find nearby hosts without knowing or entering a place name.

## What Changes

- Add an explicit Use my location action to the Android host map.
- Use a bounded foreground location lookup through Android platform providers. Centre the map and refresh nearby hosts using the active filters.
- Label approximate results and leave the map usable if the lookup cannot complete.

## Impact

- Affected specs: native-android-member-app
- Affected code: Android host map, foreground permission declarations and Android tests
