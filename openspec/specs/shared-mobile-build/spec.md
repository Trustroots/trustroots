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

### Requirement: Regular iOS Nostranslation review alert controls use Compose

The regular iOS signing sheet SHALL use shared Compose for the review alert
action and status when the active account has a connected Nostranslation
client. The iOS host SHALL handle notification permission, registration and
account scoping through the existing alert manager.

#### Scenario: Open the signing sheet without connected clients

- **GIVEN** an active account has a local Nostr key and no connected clients
- **WHEN** the member opens the Nostranslation signing sheet
- **THEN** the review alert controls are unavailable until a client is connected

### Requirement: Shared iOS Nostranslation connected client rows

The regular iOS Nostranslation signing sheet SHALL use shared Compose to render each connected client's label and revoke control. Swift SHALL supply only the displayed public-key prefix and handle each callback using the existing account-scoped signer.

#### Scenario: Viewing connected clients

- **WHEN** the member has paired Nostranslation clients for their active account and key
- **THEN** iOS shows the connected-client section with each client's public-key prefix and a corresponding accessible revoke control

#### Scenario: Revoking a connected client

- **WHEN** a member revokes a displayed client
- **THEN** the iOS signer applies its existing account-scoped revocation operation to that client
- **AND** the connected-client section reflects the resulting native client list

#### Scenario: Opening signing with no connected clients

- **WHEN** the member opens the signing sheet without any connected clients for their active account and key
- **THEN** the connected-client section and its revoke controls are hidden

### Requirement: Shared iOS Nostranslation pending review presentation

The regular iOS Nostranslation signing sheet SHALL present its pending translation review's destination, expiry feedback and decision controls with shared Compose. The iOS host SHALL bind the controls to the displayed native review and use the existing signer to resolve it.

#### Scenario: Approving a displayed review

- **WHEN** a pending review appears in the iOS signing sheet
- **THEN** Compose displays the destination and explicit approval and denial controls
- **AND** selecting approval passes the displayed review to the existing native signer for authorisation

#### Scenario: Viewing an expired review

- **WHEN** the iOS timeline marks the displayed review expired
- **THEN** Compose shows the expiry warning, disables approval and offers dismissal
- **AND** the native signer continues to check the current time when resolving an approval

#### Scenario: Acting on a replaced review

- **WHEN** the displayed review has been removed or replaced before the native decision is handled
- **THEN** the stale action leaves the current review available for its own explicit decision

### Requirement: Regular iOS Account uses shared email and newsletter preferences

The regular iOS Account screen SHALL show the email and newsletter controls,
pending email confirmation and save feedback in shared Compose. It SHALL use
the existing iOS account session and authenticated update. Password, sign-out
and Nostr actions SHALL remain available in the Account screen.

#### Scenario: Save account preferences from Compose

- **GIVEN** a signed-in member has opened Account
- **WHEN** they change their email or newsletter preference and save
- **THEN** the app submits those preferences using its existing authenticated update
- **AND** the form shows success or the returned error and any pending email confirmation

### Requirement: Regular iOS Account uses shared password actions

The regular iOS Account screen SHALL use Compose for the Change password
and recovery actions and their feedback. It SHALL preserve Swift secure fields,
the existing authenticated password update and the bounded recovery browser route.
The action SHALL be available when all three password fields contain values
and no password change is in progress.

#### Scenario: Change a password from Account

- **GIVEN** a signed-in member has completed the native password fields
- **WHEN** they use the Compose Change password action
- **THEN** the app submits the request with the existing iOS password client
- **AND** it shows a returned error or clears the fields and confirms success

#### Scenario: Open password recovery from Account

- **GIVEN** a member is viewing the password section
- **WHEN** they choose to recover their password
- **THEN** the app opens the existing iOS recovery route

### Requirement: Regular iOS Account uses shared Nostr public-key status

The regular iOS Account Nostr section SHALL use shared Compose for the Nostr
introduction, profile-key availability and local-key status. It SHALL supply
only availability flags to the shared presentation. The iOS host SHALL keep
selectable key values, account scoping, key operations and their existing
confirmations.

#### Scenario: View the account's Nostr key status

- **GIVEN** a signed-in member has opened Account
- **WHEN** their profile or local key availability changes
- **THEN** the shared status reflects that account's state and the native controls display the applicable key values and actions

### Requirement: Shared iOS Account overview presentation

The regular iOS member Account screen SHALL render its heading, Nostranslation signing entry point and sign-out action with shared Compose. The iOS host SHALL own account loading, signing navigation and session sign-out.

#### Scenario: Viewing Account while the profile loads

- **WHEN** an authenticated member opens Account while their profile is loading
- **THEN** the shared Account heading remains visible while iOS presents the loading indicator
- **AND** the actions appear when the initial loading stage completes

#### Scenario: Opening signing from Account

- **WHEN** a member selects Nostranslation signing
- **THEN** iOS presents the existing Nostranslation signing sheet

#### Scenario: Signing out from Account

- **WHEN** a member selects Sign out
- **THEN** iOS runs the existing session sign-out flow
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

### Requirement: Regular iOS profile uses shared Circle links

The regular iOS profile SHALL display the member's joined Circle links in
Compose and use the current width to wrap them. Selecting a Circle SHALL
open the existing Circle detail route.

#### Scenario: Open a Circle from a member profile

- **GIVEN** a regular iOS profile has a joined Circle
- **WHEN** the viewer opens the Circle from the profile
- **THEN** the Circle detail opens and Back returns to the member profile

### Requirement: Regular iOS profile uses shared hosting summary

The regular iOS profile SHALL present the member's hosting status, available
description and guest capacity in Compose. Meeting availability SHALL be shown
independently of hosting, while volunteering and capacity SHALL follow the
active hosting offer.

#### Scenario: Show meeting availability without active hosting

- **GIVEN** a regular iOS profile has a meeting status and no active offer
- **WHEN** the viewer reads the hosting summary
- **THEN** they see both the meeting availability and inactive hosting status

### Requirement: Regular iOS profile uses a shared identity header

The regular iOS profile SHALL display the member's identity and tagline in
Compose. It SHALL use the existing iOS avatar source and preserve the background
artwork. When present, Back SHALL occupy a separate row above the avatar.

#### Scenario: Read a member profile opened from Search

- **GIVEN** a member opens a profile from a Search host card
- **WHEN** the profile loads
- **THEN** the avatar, identity and tagline are visible below Back
- **AND** Back returns to the host card

### Requirement: Regular iOS member reporting uses shared action presentation

The regular iOS report sheet SHALL use shared Compose for the target, send
action, and error and success presentation. It SHALL preserve the native
report editor, keyboard Done action, authenticated report request and sheet
dismissal. A blank report SHALL be ineligible to send.

#### Scenario: Retry a member report

- **GIVEN** a signed-in member has written a report about another member
- **WHEN** the support request fails
- **THEN** the sheet shows the error and preserves the report text
- **AND** after a successful retry it confirms delivery and allows the reporter to close the sheet

#### Scenario: Cancel a member report

- **GIVEN** a member has opened the report sheet and a send is not in progress
- **WHEN** they choose Cancel
- **THEN** the app dismisses the sheet and returns to the member profile

### Requirement: Regular iOS bottom navigation uses shared Compose

The signed-in iOS shell SHALL use shared Compose for the Home, Search,
Messages, and Menu actions and make the selected destination available
to accessibility services. The iOS shell SHALL own destination routing,
bottom safe-area handling, and navigation visibility while typing.

#### Scenario: Select Search from Home

- **GIVEN** a signed-in member is on Home
- **WHEN** they choose Search in the bottom navigation
- **THEN** the native Search destination opens and Search is marked selected
- **AND** the bottom navigation hides while the member types and returns when the keyboard closes

### Requirement: iOS saved-data notices use shared Compose

The regular iOS app and shared member pilot SHALL render their saved-data
notice with shared Compose. The notice SHALL expose the complete text to
accessibility services. The iOS host SHALL continue to supply the locale-formatted
saved timestamp and to clear the notice when live data becomes available.

#### Scenario: Read a saved profile in the regular iOS app

- **GIVEN** a signed-in member previously loaded their profile
- **WHEN** they open the profile while its server connection is unavailable
- **THEN** the app displays the saved profile and announces its saved timestamp
- **AND** a successful live inbox request clears the notice

