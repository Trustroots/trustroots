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

### Requirement: Regular iOS hosting availability uses Compose

The regular iOS hosting editor SHALL use shared Compose for hosting and
meeting availability, maximum guests when hosting is possible, and visibility
within the member's circles. It SHALL use the existing form validation,
location capture and offer save flow.

#### Scenario: Save availability from the iOS hosting editor

- **GIVEN** a signed-in member opens an existing hosting offer
- **WHEN** they change meeting availability or circle visibility and save
- **THEN** the editor submits those changes on the existing offer with its saved coordinates
- **AND** maximum guests remains between zero and 99 and is editable when hosting is available or tentative

### Requirement: Regular iOS hosting details use Compose

The regular iOS hosting editor SHALL use shared Compose for the hosting
description, the explanation shown when unavailable and the volunteering
setting. It SHALL save with the existing offer validation and location data.
Existing rich text SHALL be retained for descriptions that the member leaves
unchanged.

#### Scenario: Edit a multiline host offer description

- **GIVEN** a signed-in member opens an existing offer with saved descriptions and coordinates
- **WHEN** they edit the reason they are unavailable across multiple lines and save
- **THEN** the existing offer contains the edited text and its original coordinates
- **AND** the unchanged hosting description retains its saved rich text

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

### Requirement: iOS offer map uses shared map actions

The regular iOS offer map SHALL display accessible Search filters and Use
current location buttons in Compose with 44-point hit targets. Search filters
SHALL open the existing filter sheet. Use current location SHALL call the
native location manager so its permission and error handling apply. The
separate button hosts SHALL leave the surrounding map available for gestures.

#### Scenario: Open filters from the map actions

- **GIVEN** a member is viewing the regular iOS offer map
- **WHEN** they select Search filters
- **THEN** the existing filter sheet appears and closing it returns to the same map

### Requirement: iOS selected Community Notes use a shared card

The regular iOS map SHALL show the selected Community Note in shared Compose
with its original text, a preview of up to four lines, the native-formatted
source attribution and an accessible Dismiss action. The iOS host SHALL handle
note selection and size the card to its content.

#### Scenario: Read a selected Community Note

- **GIVEN** a member selects a Community Note marker
- **WHEN** the note card appears
- **THEN** the shared card shows the note and its publication date
- **AND** selecting Dismiss clears the existing map selection

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

### Requirement: Regular iOS conversations use shared Compose

The regular iOS app SHALL display conversation history and multiline replies in Compose.
It SHALL use the existing iOS session, message cache, read tracking and profile
and Experience routes. It SHALL keep unsent drafts in protected storage scoped
to the server, account and recipient. A failed send SHALL leave the draft
available for explicit retry. A successful send SHALL clear that draft and
show the new reply.

#### Scenario: Retry a failed reply after relaunch

- **GIVEN** a member opens a regular iOS conversation
- **WHEN** they write a reply, delivery fails and they relaunch the app
- **THEN** the conversation restores the unsent reply and its cached history when available
- **AND** a successful manual retry displays the reply and clears the draft

### Requirement: Regular iOS conversations use a shared Experience form

The regular iOS conversation SHALL present Experience interaction choices,
recommendation and optional public feedback in Compose. Sharing SHALL require at
least one interaction. The native iOS host SHALL present and dismiss the sheet
and submit through the existing authenticated Experience API. A failed request
SHALL keep the entered choices and feedback available for manual retry.

#### Scenario: Retry sharing an Experience in a conversation

- **GIVEN** a signed-in member can share an Experience from a regular iOS conversation
- **WHEN** they choose an interaction and recommendation and the request fails
- **THEN** the form displays the error and preserves the form values
- **AND** a successful manual retry dismisses the sheet and updates the conversation action

### Requirement: Regular iOS Circle details use Compose

The regular iOS Circle detail SHALL show the Circle summary and member
discovery in Compose using the existing iOS artwork and member cache. It SHALL
show loading, empty and unavailable states, offer retry when a request fails,
and use the existing member profile and Wiki routes.

#### Scenario: Discover members and return to Circles

- **GIVEN** a signed-in member opens a Circle with discoverable members
- **WHEN** they select a member profile and return to the detail
- **THEN** the Circle details and discovered members are available again
- **AND** returning to Circles preserves their existing list filter

### Requirement: Regular iOS support uses the shared form

The regular iOS support destination SHALL use shared Compose for its message
form, delivery feedback and FAQ action. It SHALL use the existing authenticated
iOS support client and bounded FAQ browser route.

#### Scenario: Retry a support message after a failed send

- **GIVEN** a signed-in member has written a support message
- **WHEN** delivery fails
- **THEN** the form displays the error and keeps the message available for retry
- **AND** after a successful retry it clears the draft and confirms delivery

#### Scenario: Open the FAQ from support

- **GIVEN** a member is using the support form
- **WHEN** they choose to browse frequently asked questions
- **THEN** the app opens the existing FAQ browser route

### Requirement: Regular iOS profile editing uses the shared form

The regular iOS profile editor SHALL use shared Compose for the name, tagline,
locations, language selector, biography and save action. It SHALL use the
existing authenticated iOS profile update, require a nonblank name and preserve
the existing trimming and biography loading rules. Language selection SHALL
use the existing iOS picker.

#### Scenario: Edit and save profile text from Compose

- **GIVEN** a signed-in member opens the profile editor
- **WHEN** they update their tagline or biography and save
- **THEN** the app submits the new text with the other loaded preferences through the existing iOS profile update
- **AND** the app returns to the profile after a successful save
