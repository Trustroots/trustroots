## Why

The Android profile currently crops its avatar into the profile hero and does
not let a member inspect the photo at its available resolution. Issue #3234
calls for a focused full-screen profile image view with predictable sizing and
zoom.

## What Changes

- Let a member open a profile photo in a black, full-screen native viewer from
  the profile image.
- Lazily request the largest existing avatar rendition (2048 pixels) only
  after the viewer opens, using the existing session-aware artwork transport
  and cache, and show the image without cropping.
- Fit the image to the available content bounds without enlarging it. Let pinch
  zoom range from that fit scale to one source image pixel per physical display
  pixel, with panning constrained to the image bounds.
- Make close behaviour predictable through an accessible close control and
  system Back, restore the same profile and section on close, and handle system
  bars and display cut-outs. Keep status and navigation icons white against
  the black viewer in both system appearances, then restore the prior window
  appearance on close.
- Keep the viewer usable when the image is loading, unavailable, or the device
  is offline. Image loading failure does not invalidate the member session.
- Add anonymous Android device tests for sizing, zoom limits, loading failure,
  accessibility, insets and close behaviour.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: add full-screen viewing for profile photos.

## Impact

- Android UI under `apps/android`, especially `ui/common/RemoteArtwork.kt`,
  `ui/profile/MemberProfileScreen.kt`, and the existing avatar URL builder in
  `api/MobileApiClient.kt`.
- Android Compose device tests under `apps/android/app/src/androidTest`.
- No server route, account data, or persistent image format changes; no new
  dependency is expected.
