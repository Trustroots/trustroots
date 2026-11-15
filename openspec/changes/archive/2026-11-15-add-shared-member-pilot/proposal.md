# Add a shared Compose member journey pilot

## Why

The shared Android/iOS build foundation is in place. Issue #3232 needs a working
member journey to assess the SwiftUI integration and the value of sharing UI.

## What Changes

- Add a Compose pilot for sign-in, profiles, the inbox, conversations and replies.
- Use the existing platform API clients and secure session state behind a small
  presentation interface. Keep the existing application identifiers and native
  screens.
- Use a debug launch option to compare the pilot with native screens and exercise
  it on both platforms before changing any defaults.
- Add a controlled-server journey on each platform and record the parity and
  release checks that remain.

## Impact

- Affected specs: shared-mobile-build
- Affected code: apps/shared, apps/android, apps/ios
