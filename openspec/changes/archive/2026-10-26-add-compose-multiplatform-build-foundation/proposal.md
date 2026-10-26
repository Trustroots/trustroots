## Why

Issue #3232 calls for an initial Compose Multiplatform iOS build while keeping
the existing native iOS app available as the comparison and fallback. The
assessment found that the Android app's Kotlin, Gradle and Android Gradle
Plugin versions do not form a documented Kotlin Multiplatform combination.
Before sharing member features, the repository needs a small, repeatable build
foundation that proves the same common Compose source can compile for Android
and iOS.

## What Changes

- Pin a documented compatible Kotlin Multiplatform, Compose Multiplatform,
  Gradle, Android Gradle Plugin and Xcode toolchain combination.
- Add a small `apps/shared` library with Android and iOS targets and a minimal
  common Compose entry point; do not move existing Android screens or member
  behaviour in this change.
- Link the shared framework into the existing iOS app project and its generator
  so Xcode can build it while SwiftUI continues to own all destinations.
- Make Android and iOS CI builds react to shared-module and build-configuration
  changes.

## Impact

Affected areas: `apps/android` Gradle configuration, the new `apps/shared`
module, `apps/ios` project integration and generator, and mobile CI workflows.
There is no server, API, data, signing, bundle identifier or user-flow change.
The Compose entry point is build-only groundwork and is not installed as an app
destination. Existing Android Compose screens and iOS SwiftUI destinations
remain authoritative. No migration or release action is included.
