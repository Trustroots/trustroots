# Native Android Member App Specification

## Purpose

Apply the shared native member product direction through Android-native
interfaces and platform conventions.

## ADDED Requirements

### Requirement: Android implementation of native parity

The Android member application SHALL provide the accepted iOS reference
outcome and information hierarchy for applicable shared journeys. It SHALL use
Android-native interaction, accessibility, inset, keyboard, lifecycle and
security conventions where these differ from iOS.

#### Scenario: Android uses a platform-native adaptation

- **WHEN** an applicable reference journey uses an iOS-specific interaction
- **THEN** Android uses the corresponding Android-native interaction
- **AND** preserves the documented member outcome and information hierarchy

### Requirement: Android sign-in shell parity

The Android signed-out screen SHALL present the Trustroots identity, sign-in
form, account-entry links and build timestamp in a keyboard-aware, safe-area-
aware and scrollable layout. It SHALL NOT display the configured API origin
before sign-in, while the signed-in menu SHALL retain that diagnostic value.

#### Scenario: Member opens the Android sign-in screen

- **WHEN** the Android application has no stored member session
- **THEN** the sign-in content begins above the vertical centre
- **AND** the screen displays the build timestamp as `yyyy-MM-dd HH:mm`
- **AND** the configured API origin is not displayed

#### Scenario: The keyboard constrains the sign-in screen

- **WHEN** the member enters credentials on a constrained display
- **THEN** the layout respects safe drawing and keyboard insets
- **AND** the member can scroll to reach the form actions and build metadata

#### Scenario: A signed-in member opens the Android menu

- **WHEN** the member opens the signed-in application menu
- **THEN** the menu displays the configured API origin for diagnostics

### Requirement: Android member-session cookie selection

The Android client SHALL inspect all `Set-Cookie` response values after
sign-in and SHALL retain the `connect.sid` cookie as the member-session
credential regardless of header casing or the presence of unrelated cookies.

#### Scenario: Sign-in returns routing and member-session cookies

- **WHEN** a successful sign-in response contains an unrelated routing cookie
  and a `connect.sid` cookie
- **THEN** the Android client stores the `connect.sid` name and value
- **AND** does not store the unrelated cookie as the member session

### Requirement: Persistent Android member navigation

The signed-in Android application SHALL provide labelled Circles, Search,
Messages and Menu destinations in persistent bottom navigation. Selecting a
destination SHALL replace the main content without moving the primary
navigation to the top of the display.

#### Scenario: Member opens the signed-in Android application

- **WHEN** a stored member session is available
- **THEN** the application displays the Circles destination
- **AND** labelled Circles, Search, Messages and Menu actions remain at the
  bottom of the display

#### Scenario: Member changes primary destination

- **WHEN** the member selects a bottom navigation action
- **THEN** the corresponding native destination replaces the main content
- **AND** the selected action is visually identified

### Requirement: Android native circle list

The Android Circles destination SHALL load the established `/api/tribes`
collection and display native circle rows containing the available label,
description and member count. It SHALL provide loading, empty, error and retry
states.

#### Scenario: Circles are available

- **WHEN** the circle request succeeds with one or more circles
- **THEN** the Android application displays the circles in a scrollable native
  list
- **AND** each row shows its label and available summary information

#### Scenario: Circles cannot be loaded

- **WHEN** the circle request fails without invalidating the member session
- **THEN** the destination explains that circles are unavailable
- **AND** provides a retry action

### Requirement: Android native offer map

The Android Search destination SHALL render an interactive native map and
request authorised host offers for its initial visible region through the
established `/api/offers` contract. Returned valid coordinates SHALL appear as
map annotations, and required map-data attribution SHALL remain visible.

#### Scenario: Member opens Search

- **WHEN** the member selects Search
- **THEN** an interactive native map is centred on the reference initial region
- **AND** the application requests authorised hosts seen within the past six
  months
- **AND** valid returned host coordinates appear as map annotations

#### Scenario: Offers cannot be loaded

- **WHEN** the offer request fails without invalidating the member session
- **THEN** the map remains usable
- **AND** an unobtrusive error and retry action are displayed

### Requirement: Android native message inbox

The Android Messages destination SHALL load the established `/api/messages`
inbox and display native conversation rows containing the other member,
available message excerpt and unread state. It SHALL provide loading, empty,
error and retry states.

#### Scenario: Conversations are available

- **WHEN** the inbox request succeeds with one or more conversations
- **THEN** the application displays the other member and latest available
  excerpt for each conversation
- **AND** unread conversations are visually distinguished

#### Scenario: Member has no conversations

- **WHEN** the inbox request succeeds with an empty collection
- **THEN** the destination explains that there are no conversations yet

#### Scenario: Messages cannot be loaded

- **WHEN** the inbox request fails without invalidating the member session
- **THEN** the destination explains that messages are unavailable
- **AND** provides a retry action

### Requirement: Destination session invalidation

API-backed Android destinations SHALL clear the locally stored member session
and return to sign-in when the server rejects that session as unauthorised.

#### Scenario: A destination request finds an expired session

- **WHEN** Circles, Search or Messages receives an authentication failure
- **THEN** the stored credential is removed
- **AND** the member is asked to sign in again
