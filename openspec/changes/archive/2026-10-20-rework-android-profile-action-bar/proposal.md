## Why

The Android profile action row can scroll horizontally to reach actions, while
the artwork begins below the row. On narrow phones this makes Back and the
main message action less direct, and separates the profile controls from the
artwork they belong to. A fixed, accessible action layout over one continuous
artwork header will make the common profile journey easier to use while
preserving the compact profile frame.

## What Changes

- Place Back on the left and, for another member's profile, a primary “Send a
  message” action on the right at supported phone widths.
- Move experience sharing and contact actions into an accessible overflow
  menu, retaining the current contact labels, pending/confirmed states and
  remove confirmation.
- Keep self-profile editing available through the same action area.
- Extend the existing profile artwork behind the action area and to the top
  system insets, with scrim and readable controls; retain one artwork header
  and the existing shared artwork-backed tabs.
- Keep the header and tabs outside the pager, with only section content in the
  pager, and preserve photo-viewer state and callbacks.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: profile actions use a fixed primary layout and
  overflow for secondary actions while maintaining the shared, compact profile
  frame and its existing navigation behaviour.

## Impact

- Changes Android profile Compose UI, Android string resources and journey
  coverage under `apps/android`.
- Updates the Android member app OpenSpec capability.
- Does not change API behaviour, persisted data, server routes or iOS.
- No migration or deployment coordination is required; the change ships with
  the Android app.
