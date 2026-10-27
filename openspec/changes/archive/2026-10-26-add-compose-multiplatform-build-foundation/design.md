## Context

The existing Android application is a native Kotlin/Jetpack Compose app under
`apps/android`. The existing iOS app is SwiftUI under `apps/ios`, generated
from `apps/ios/scripts/generate_xcodeproj.rb`. The source assessment proposes
adding a KMP library at `apps/shared`, retaining both native application roots,
and using a `ComposeUIViewController` boundary only when a shared journey is
ready.

The checked-in Android toolchain currently uses Kotlin 2.3.21, Gradle 9.4.1
and AGP 9.2.1. JetBrains' official compatibility table lists Kotlin 2.3.20–2.3.21
with Gradle through 9.3.0, AGP through 9.0.0 and Xcode 26.0. Kotlin 2.4.20–2.4.21
is listed with Gradle through 9.7.0, AGP through 9.3.1 and Xcode 26.4. Pin
Kotlin 2.4.21 while retaining Gradle 9.4.1 and AGP 9.2.1; both are within the
documented ranges. Pin Compose Multiplatform 1.12.2 separately, as the Compose
UI release cycle is independent of Kotlin. Use Xcode 26.4.1 for the documented
iOS build gate.

References:

- https://kotlinlang.org/docs/multiplatform/multiplatform-compatibility-guide.html
- https://kotlinlang.org/docs/multiplatform/compose-compatibility-and-versioning.html
- https://kotlinlang.org/docs/multiplatform/compose-swiftui-integration.html

## Decisions

- Keep `apps/android` as the Gradle root and add `:shared` from that build.
- Put common Compose UI in `apps/shared`, with a supported Android library
  target and arm64 iOS device/simulator frameworks. Keep platform adapters and
  application entry points in their existing apps.
- Add only a minimal, inert shared Compose screen and a SwiftUI controller
  wrapper to prove compilation and framework linkage. Do not add a route to the
  app or change the default destination; the wrapper is not shown by either
  app in this foundation step.
- Keep the Xcode project generator authoritative: generation must preserve the
  shared framework integration and invoke the Gradle framework build before
  Swift compilation.
- Extend mobile CI path filters and build jobs so shared code changes exercise
  both Android and the iOS simulator app build. Retain the existing native
  test suites and app identity.

## Risks

- Kotlin/Native compilation adds a compatible Xcode and JDK requirement to the
  iOS CI job. Pin the Xcode version rather than relying on the runner default.
- Linking a framework before the shared member journey exists increases the
  binary slightly. Measure size when the journey is added; this change makes no
  performance or migration-savings claim.
- Kotlin 2.4.21 is a coordinated plugin update for the existing Android app.
  Build the existing Android application in the same change to catch regressions.
