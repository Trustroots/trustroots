# Shared mobile build

## Purpose

Build shared Kotlin and Compose UI in the existing Android and iOS
applications and verify both platform integrations in continuous integration.

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

### Requirement: Debug builds can present a shared member journey

Android and iOS debug builds SHALL provide an explicit launch option that opens
the shared Compose member journey and allows returning to the native app.
The host SHALL use its existing secure session and authenticated API client.

#### Scenario: Sign in and reply from a profile

- **GIVEN** a signed-out member opens the shared journey
- **WHEN** they sign in, open an inbox partner's profile and send a reply
- **THEN** the shared screens show the authenticated profile and conversation
- **AND** the successful reply appears once in the conversation
- **AND** the native app can use the same saved session

#### Scenario: Read a conversation from the inbox

- **WHEN** a signed-in member opens a conversation from their inbox
- **THEN** Compose displays the conversation and can return to the inbox

#### Scenario: A reply fails

- **WHEN** the API rejects a reply
- **THEN** the shared conversation displays an error and retains the reply for
  intentional retry

### Requirement: Shared pilot starts at a member dashboard

The signed-in shared Compose pilot SHALL start at a dashboard on Android and
iOS. It SHALL offer the shared profile and inbox journeys and explain Nostroots
with a link to its public introduction. Dashboard actions SHALL remain usable
without profile, circle or local-event responses. Existing native app defaults
SHALL remain unchanged during the pilot.

#### Scenario: A saved member opens the shared pilot

- **WHEN** a signed-in member opens the shared pilot
- **THEN** Home offers My profile, Messages and Learn about Nostroots
- **AND** opening profile or messages and going Back returns to Home
- **AND** Open native app exits using the existing host callback

#### Scenario: A member signs in from the shared pilot

- **WHEN** sign-in succeeds and the host supplies the authenticated username
- **THEN** the shared pilot displays Home using the existing secure session
- **AND** no profile, circle or local-event request is required to render Home
