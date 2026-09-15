## Why

Trustroots should offer the same core native member experience on Android as
on iPhone. Android members need a first-class application for profiles,
circles, map search and conversations without making the website the primary
interface.

The Android application can share the versioned mobile API and product scope
defined for the iOS MVP, while using Android-native interface, security and
lifecycle patterns.

## What Changes

- Add a native Kotlin and Jetpack Compose Android application.
- Reuse the versioned mobile member API and the same member-facing MVP scope as
  the native iOS application.
- Store mobile credentials using Android Keystore-backed storage.
- Provide native profile, circle, map, messaging, experience and account
  interfaces, with an embedded WebView fallback for explicitly deferred
  Trustroots website flows.
- Keep administration and moderation on the website.
- Defer Firebase Cloud Messaging until after the core MVP is usable, matching
  the iOS decision to defer APNs.

## Capabilities

### New Capabilities

- `native-android-member-app`: a native Android application for the defined
  Trustroots member MVP.

### Modified Capabilities

- `mobile-member-api`: Android and iOS clients use the same versioned mobile
  authentication and member resources.

## Impact

- Adds a Gradle/Kotlin Android project under `apps/android`.
- Adds Android unit, integration and Compose UI tests as features are built.
- Adds no administrator or moderation interface.
- Does not change existing browser or iOS behaviour.
