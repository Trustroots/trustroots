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

### Requirement: Regular iOS profile uses shared biography and language sections

The regular iOS profile SHALL use Compose to display a member's biography
and language names when present. The existing iOS profile scroll view SHALL
accommodate the full text at the current width and text size. The language
section SHALL use the existing language catalogue and preserve when its title
is shown.

#### Scenario: Read a member's biography and languages

- **GIVEN** a member opens a regular iOS profile with a biography and spoken languages
- **WHEN** they scroll through the profile
- **THEN** they can read the full plain-text biography and the resolved language names

### Requirement: Regular iOS profile uses shared activity and location sections

The regular iOS profile SHALL display last login, reply rate and any available
reply time in Compose. It SHALL show actions for the member's current location
and place of origin when available, using the existing iOS search map route.

#### Scenario: Read activity and open a location

- **GIVEN** a member opens a profile with reply statistics and a current location
- **WHEN** they read the activity section and select the location
- **THEN** they can see the reply statistics and the app opens the Search map for that location

### Requirement: Regular iOS profile uses shared contact rows

The regular iOS profile SHALL render its contact list with the shared Compose
row and the existing iOS avatar. It SHALL initially show up to six contacts
and allow the member to show more and collapse the list. A contact with a
username SHALL open the native member profile.

#### Scenario: Browse contacts from My profile

- **GIVEN** a member has more than six contacts
- **WHEN** they expand the list and then select one of their contacts
- **THEN** the full list is available and the contact's profile opens
- **AND** returning allows the member to collapse the list

### Requirement: Regular iOS profile uses shared Experiences presentation

The regular iOS profile SHALL render public Experience statistics, feedback
and available responses using Compose. It SHALL show up to six cards by default,
allow expansion and collapse, and use the existing profile route for authors
and respondents with usernames.

#### Scenario: Read a member's published experiences

- **GIVEN** a regular iOS profile has public Experience feedback and a public response
- **WHEN** a member visits the Experiences section
- **THEN** they see the summary and both published texts
- **AND** selecting an author opens their native profile

### Requirement: Regular iOS profile uses shared member actions

The regular iOS profile SHALL render applicable edit, hosting, message,
report and block controls in Compose. The iOS host SHALL own navigation,
confirmation and authenticated block requests. A blocked member SHALL
remain unavailable for messaging until unblocked.

#### Scenario: Block and unblock a member

- **GIVEN** a signed-in member opens another member's profile
- **WHEN** they confirm Block
- **THEN** the profile offers Unblock and hides its message action
- **AND** confirming Unblock restores the message action
