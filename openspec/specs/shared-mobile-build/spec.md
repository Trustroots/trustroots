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

The existing Android navigation and the regular iOS member shell SHALL remain
available while shared screens are promoted individually.

#### Scenario: Existing Android destinations continue to launch

- **WHEN** the Android app is launched normally
- **THEN** the existing Android navigation and destinations remain in use

#### Scenario: Existing iOS destinations continue to launch

- **WHEN** a signed-in member launches the iOS app normally
- **THEN** shared Home opens within the regular SwiftUI member shell
- **AND** Search, Messages and Menu remain available

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

### Requirement: The iOS pilot keeps unsent replies on the device

The iOS Compose pilot SHALL save unsent replies in protected local storage,
scoped to the authenticated server, account and conversation recipient. The
same account SHALL be able to reopen its drafts after relaunch or signing back
in. The pilot SHALL remove a draft when its content is deleted or its send
succeeds, and SHALL leave it available for manual retry after failure.

#### Scenario: Reopen a conversation after a failed send

- **GIVEN** a signed-in member writes a reply that fails to send
- **WHEN** they relaunch the pilot and reopen the same conversation
- **THEN** the composer restores the unsent reply
- **AND** the reply is only sent when the member retries
- **AND** a successful retry clears the stored draft

#### Scenario: Read drafts from the current account and server

- **GIVEN** a draft was written for one recipient on one account and server
- **WHEN** the pilot opens a different recipient, account or server
- **THEN** it does not display the first draft

### Requirement: Shared pilot starts at a member dashboard

The signed-in shared Compose pilot SHALL start at a dashboard on Android and
iOS. It SHALL offer the shared profile and inbox journeys. Dashboard actions
SHALL remain usable without profile, circle or local-event responses. The
pilot SHALL remain opt-in.

#### Scenario: A saved member opens the shared pilot

- **WHEN** a signed-in member opens the shared pilot
- **THEN** Home offers My profile and Messages
- **AND** opening profile or messages and going Back returns to Home
- **AND** Exit shared pilot exits using the existing host callback

#### Scenario: A member signs in from the shared pilot

- **WHEN** sign-in succeeds and the host supplies the authenticated username
- **THEN** the shared pilot displays Home using the existing secure session
- **AND** Home renders even if discovery requests fail

### Requirement: Shared dashboard shows homepage discovery

The shared dashboard SHALL show the public featured Nostr feed and use the same connection discovery rules as the signed-in website. It SHALL preserve access to profile and messages when discovery is unavailable.

#### Scenario: Dashboard has discovery data

- **WHEN** featured notes and eligible connection data are available
- **THEN** Home shows the featured notes and recently active connections in server order
- **AND** the map distinguishes approximate hosting and meeting locations
- **AND** the dashboard omits the Nostroots introduction

#### Scenario: Discovery is unavailable

- **WHEN** either discovery request fails
- **THEN** the other section and core navigation remain independently usable

### Requirement: Shared pilot provides bottom navigation

The signed-in shared pilot SHALL provide persistent bottom tabs for Home,
Messages and My profile.

#### Scenario: Switch from a shared journey to Home

- **GIVEN** a signed-in member is reading their inbox or profile
- **WHEN** they select the Home tab
- **THEN** the dashboard is displayed and the Home tab is selected

### Requirement: Mobile apps can preview shared Home in the regular member shell

Android debug builds SHALL offer shared Home through an explicit launch option.
The regular iOS app SHALL show shared Home as the signed-in default. The
member shell SHALL retain Search and Messages tabs and access to Circles from
Android Profile or iOS Menu when shared Home is in use. Shared Home SHALL reuse
the host session and native profile navigation.

#### Scenario: Open a connection in the regular app shell

- **GIVEN** a member opens shared Home in the regular member shell
- **WHEN** they open a connection from the Home dashboard
- **THEN** the regular platform profile screen opens using the existing session
- **AND** dismissing the profile returns to Home with the regular tab bar available

### Requirement: Regular iOS sign-in uses the shared Compose form

The regular iOS app SHALL display the shared Compose sign-in form when signed
out. The form SHALL use native iOS password input traits and the existing
secure iOS session store. The iOS host SHALL retain Join through its bounded
browser, sign-in errors, server and build diagnostics, and the debug simulator
server picker.

#### Scenario: Sign in from a regular iOS launch

- **GIVEN** a signed-out member launches the iOS app normally
- **WHEN** they submit valid credentials from the shared sign-in form
- **THEN** the app displays the regular SwiftUI member destinations
- **AND** a new launch uses the saved iOS session

#### Scenario: Open Join while signed out

- **WHEN** a signed-out member chooses Join from the shared form
- **THEN** the iOS bounded browser opens Join and can return to sign-in

### Requirement: Regular iOS Messages uses the Compose inbox

The regular iOS Messages tab SHALL present a Compose inbox with conversation
avatars, excerpts, timestamps and unread state. It SHALL reuse existing iOS
pagination, filtering by member or message content, and offline cache behaviour.
Tapping a conversation SHALL open the regular iOS conversation. Returning to
the inbox SHALL refresh unread state and preserve the current filter.

#### Scenario: Filter conversations and return to the inbox

- **GIVEN** the member has an unread conversation
- **WHEN** they filter the inbox, open the conversation and go Back
- **THEN** the filter is still applied
- **AND** the inbox displays the read state returned by the API

### Requirement: Regular iOS Menu uses Compose

The regular iOS Menu SHALL use Compose to display its member actions,
support and website links, and the iOS build label. It SHALL invoke the
host’s existing navigation and bounded browser.

#### Scenario: Open a regular iOS menu item

- **GIVEN** a signed-in member opens Menu
- **WHEN** they select an account or member action
- **THEN** the corresponding existing iOS screen opens
- **AND** website links open in the bounded browser and can return to Menu

### Requirement: Regular iOS Contacts uses Compose

The regular iOS Contacts screen SHALL use Compose to show contacts, avatars
and pending confirmations. It SHALL use the existing iOS API, keep loading
and empty states and provide a retry action when the request fails. Contacts
with a username SHALL open the existing iOS profile.

#### Scenario: Open a contact’s profile

- **GIVEN** a signed-in member opens Contacts
- **WHEN** they select a contact with a username
- **THEN** the existing iOS profile opens for that contact

### Requirement: iOS offer search uses shared filter controls

The regular iOS offer search SHALL render its offer type, activity, language and
Circle filter controls in shared Compose. The iOS host SHALL continue to apply
the filters to Map and Results and provide the existing language picker, Reset
and Done actions.

#### Scenario: Apply connected volunteering filters

- **GIVEN** a member opens Search filters while viewing offers
- **WHEN** they enable volunteering and connections-only and close the sheet
- **THEN** hosting is enabled, Community Notes are suppressed and both Map and Results use the selected filters

#### Scenario: Reset the offer filters

- **GIVEN** a member changes the offer filters
- **WHEN** they select Reset
- **THEN** the defaults restore and the filter controls show those defaults

### Requirement: iOS offer map uses shared status and legend

The regular iOS app SHALL show its map loading indicator, offer result count,
applicable legend and search errors in shared Compose. The marker legend SHALL
use the same colours as the native annotations and reflow within the viewport.
The overlay SHALL leave map gestures available.

#### Scenario: Show the applicable markers

- **GIVEN** the iOS map has loaded offers
- **WHEN** a member restricts the map to their connections
- **THEN** the shared overlay shows the updated count and omits the Community Notes marker

### Requirement: Regular iOS Search uses a shared display selector

The regular iOS Search screen SHALL use shared Compose to select Map, Results,
or Members. It SHALL expose the selected choice to accessibility services
and preserve the existing iOS map, filters, host card navigation and member
search state.

#### Scenario: Switch across Search displays

- **GIVEN** a signed-in member opens Search
- **WHEN** they choose Results and then Members
- **THEN** the corresponding offer and member search controls are available
- **AND** returning to Map and then Members preserves the member query and results

### Requirement: Regular iOS offer results use shared place-search controls

The iOS Results display SHALL render place entry, lookup failure and the
existing filter action in Compose. A nonblank submission SHALL use the native
place lookup and update the existing search region when found.

#### Scenario: Return to offer results with a place entered

- **GIVEN** a signed-in member has entered a place on the Results display
- **WHEN** they switch to Map and then return to Results
- **THEN** the entered place remains available for submission
- **AND** the Search filters action continues to open the existing filter sheet
