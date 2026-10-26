## Requirements

### Requirement: Native applications build the shared Compose module

The Android Gradle build SHALL include a shared Kotlin Multiplatform library
that compiles common Compose UI for Android and for arm64 iOS device and
simulator targets. The toolchain versions SHALL use a documented compatible
Kotlin Multiplatform, Compose Multiplatform, Gradle, Android Gradle Plugin and
Xcode combination.

#### Scenario: Android app build includes common Compose code

- **WHEN** the existing Android app is assembled
- **THEN** Gradle compiles the shared Android target and packages the app with
  its existing application identifier

#### Scenario: iOS app build links the shared framework

- **WHEN** the existing iOS project is generated and built for an iOS simulator
- **THEN** Gradle builds the shared simulator framework and Xcode links it into
  the existing app target
- **AND** the existing iOS bundle identifier and signing configuration remain
  in effect

### Requirement: Native destinations remain the application defaults

Adding the shared build foundation SHALL NOT replace or reorder existing
Android or SwiftUI destinations. The shared Compose host MAY be compiled and
linked without being presented by either application until a shared journey is
accepted.

#### Scenario: Existing Android destinations continue to launch

- **WHEN** the Android app is launched after the shared module is added
- **THEN** the existing Android navigation and destinations remain in use

#### Scenario: Existing iOS destinations continue to launch

- **WHEN** the iOS app is launched after the framework is linked
- **THEN** the existing SwiftUI root and destinations remain in use

### Requirement: Shared-source changes run both native build gates

Continuous integration SHALL build the Android app and the iOS simulator app
when common shared-source or shared-build configuration changes. The iOS job
SHALL select an Xcode release supported by the pinned Kotlin Multiplatform
version.

#### Scenario: Shared code changes

- **WHEN** a pull request changes files under `apps/shared`
- **THEN** CI runs the Android app build and the iOS simulator app build
- **AND** the existing native test jobs remain enabled
