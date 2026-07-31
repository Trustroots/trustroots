## Why

The native iOS app is currently the more complete member-facing native
experience. Android should follow the same product direction so both native
apps stay aligned in flows, information architecture, visual hierarchy and
core behaviour while retaining appropriate platform conventions.

Native parity decisions are currently implicit. This makes it easy for Android
to drift behind or sideways from the intended member experience and makes it
unclear whether an iOS-only change is deliberate, pending or not applicable.

## What Changes

- Establish iOS as the reference implementation for member-facing native
  product behaviour unless an Android-specific variation is documented.
- Require material iOS product changes to classify Android parity as exact
  parity, close parity with Android-native adaptation, or not applicable.
- Define parity as equivalent member outcomes and information hierarchy rather
  than pixel-identical cross-platform presentation.
- Start the parity workflow with Android sign-in, persistent bottom navigation
  and API-backed Circles, Search/Map and Messages destinations, including
  robust website-session cookie selection.

## Capabilities

### New Capabilities

- `native-member-app-parity`: the shared workflow and product expectations that
  keep the native member applications aligned.

### Modified Capabilities

- `native-ios-member-app`: identifies the iOS experience as the default
  reference for shared native member behaviour.
- `native-android-member-app`: follows the reference experience while retaining
  Android-native interaction, accessibility and lifecycle conventions.

## Impact

- Adds a shared native parity contract and platform-specific deltas under
  `openspec/changes/ios-led-native-parity`.
- The initial implementation affects the Android sign-in screen, signed-in
  shell and navigation, Circles, Search/Map and Messages destinations, and
  website-session cookie parsing under `apps/android`.
- Adds no server routes, database migration, API contract change or website
  behaviour change.
- Existing iOS behaviour remains unchanged by the initial parity slice.
- Future material iOS member-facing proposals and implementation plans must
  include an Android parity classification.
