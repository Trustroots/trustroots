# Native Android Member App Specification

## Purpose

Provide Trustroots members with a secure, native Android experience for the
same core member journeys supported by the native iOS MVP.

## ADDED Requirements

### Requirement: Native Android member application

The system SHALL provide a native Android application built with Kotlin and
Jetpack Compose. Supported MVP areas SHALL use Android-native interfaces and
SHALL NOT expose administration or moderation tools.

#### Scenario: Member uses a supported MVP area

- **WHEN** a member opens account, profile, circle, offer-search or messaging
  functionality in the Android app
- **THEN** the app presents a native Android interface for that functionality

#### Scenario: Administrator needs administration tools

- **WHEN** an administrator needs administration or moderation functionality
- **THEN** that functionality remains on the website

### Requirement: Shared mobile API contract

The Android app SHALL use the same versioned mobile authentication and member
API contract as the iOS app. Platform clients SHALL receive compatible member
resources and error semantics.

#### Scenario: Member signs in on Android

- **WHEN** a member submits valid credentials in the Android app
- **THEN** the app receives a mobile session from the versioned mobile API
- **AND** can use authorised member endpoints

#### Scenario: Member signs out on Android

- **WHEN** a member signs out in the Android app
- **THEN** the server revokes the active mobile session
- **AND** the app removes its stored credentials

### Requirement: Android secure credential storage

The Android app SHALL store refresh credentials only in storage protected by
the Android Keystore and SHALL NOT persist raw credentials in logs, plain
preferences or application backups.

#### Scenario: App restores a signed-in session

- **WHEN** the application restarts with a valid stored mobile session
- **THEN** it restores the member session from Keystore-protected storage

#### Scenario: Protected storage is unavailable

- **WHEN** protected credential storage cannot be read or decrypted
- **THEN** the app clears the unusable session
- **AND** asks the member to sign in again

### Requirement: Android secure transport

The Android app SHALL send mobile credentials only to an HTTPS API origin.
Debug builds MAY use clear-text HTTP only for explicit loopback and Android
emulator host aliases, and the network security configuration SHALL keep other
clear-text destinations disabled.

#### Scenario: Build is configured with a remote clear-text API

- **WHEN** the Android client is given a remote `http://` API address
- **THEN** it rejects the address before sending credentials

#### Scenario: Emulator reaches a local development server

- **WHEN** a Debug emulator build uses the documented local host alias
- **THEN** the app may connect over HTTP without enabling remote clear-text
  traffic

### Requirement: Native Android member MVP parity

The Android MVP SHALL support native profile viewing and editing, circle
browsing and membership, map-based host search, inboxes and conversations,
native experiences, account settings and local list filtering. The behaviour
SHALL follow the same visibility and eligibility rules as the website and iOS
app.

#### Scenario: Member follows a core journey on either platform

- **WHEN** a supported core journey exists in both native applications
- **THEN** Android and iOS provide equivalent member outcomes
- **AND** each platform uses its native interaction conventions

### Requirement: Android browser fallback

The Android app SHALL provide an embedded WebView for allowlisted Trustroots
HTTPS routes that are intentionally deferred from the native MVP, including
password recovery and email confirmation. External destinations SHALL require
confirmation before leaving the app. The WebView SHALL reject mixed content,
file/content access, and unsafe external schemes.

#### Scenario: Member opens account recovery

- **WHEN** a member selects password recovery in the Android app
- **THEN** the existing Trustroots website flow opens inside the embedded
  browser

#### Scenario: Web content requests an external destination

- **WHEN** an embedded page navigates outside the Trustroots allowlist
- **THEN** the app asks before opening the destination externally

### Requirement: Android offline read-only fallback

The Android app SHALL retain successful authenticated read responses in an
account-scoped protected cache. Cached content SHALL be labelled clearly and
SHALL NOT replace server authorisation or validation failures.

#### Scenario: Server cannot be reached after prior use

- **WHEN** a read request fails because the server cannot be reached
- **AND** a matching cached response exists for the current server and account
- **THEN** the app may render that cached response with an offline warning

### Requirement: Android push notifications are follow-on work

The core Android MVP SHALL remain usable without Firebase Cloud Messaging.
Push-token registration and message notifications MAY be added after the core
native journeys are ready for testing.

#### Scenario: MVP build has no push token

- **WHEN** a member uses an MVP build without push registration
- **THEN** native profiles, search, circles and conversations remain usable
