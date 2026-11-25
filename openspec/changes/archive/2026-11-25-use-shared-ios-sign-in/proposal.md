# Make shared Compose sign-in the regular iOS entry point

## Why

The shared sign-in flow has been exercised on a physical iPhone. Adopting the
same form in the regular app advances the migration one destination at a time
and lets members continue into the complete iOS app after signing in.

## What changes

- Present the shared sign-in form at the regular iOS signed-out entry point.
- Keep the iOS session store, Password AutoFill configuration, Join browser
  route and server diagnostics at that entry point.
- Continue to use the existing iOS member shell after authentication.

## Impact

The iOS SwiftUI host and shared Compose module change. The Android application
entry point and the mobile API contract remain unchanged.
