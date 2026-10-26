## Toolchain and shared module

- [x] Upgrade and pin the Kotlin plugins to the documented compatible version.
- [x] Add a Compose Multiplatform library under `apps/shared` with Android,
      iOS device and iOS simulator targets.
- [x] Add a minimal common Compose entry point suitable for native hosting.
- [x] Include the shared Android target from the existing Android Gradle root
      without changing its application id or runtime destinations.

## iOS integration and CI

- [x] Add the shared framework build and link phases to the generated Xcode
      project and keep the checked-in project reproducible from its generator.
- [x] Add a SwiftUI-compatible controller wrapper without wiring a new app
      destination.
- [x] Update CI so shared-source changes build the Android app and the iOS
      simulator app with the documented Xcode version.
- [x] Keep existing iOS tests and Android unit/device tests intact.

## Verification and completion

- [x] Validate this proposal before implementation.
- [x] Build the existing Android app and compile the iOS simulator framework
      and app where the toolchains are available.
- [x] Regenerate the Xcode project and confirm the checked-in project has no
      unintended generated changes.
- [x] Run `pnpm check` and the relevant native build/test checks.
- [x] Archive this change and update the living mobile build specification
      after the foundation is verified.
