# native-android-member-app Specification

## Purpose

Define native Android member experiences for authentication, discovery,
communication, profiles and navigation, including state continuity and
accessible presentation.

## Requirements

### Requirement: Android preview APK update alerts

The GitHub preview Android APK SHALL let a member opt in to periodic update
checks. When a newer signed Android preview release is available, the app SHALL
notify the member at most once per version and open the corresponding Trustroots
GitHub release page on request. The app SHALL NOT install an APK automatically.
Local and F-Droid builds SHALL NOT offer GitHub preview update alerts.

#### Scenario: Member enables update alerts

- **WHEN** a member enables APK update alerts in a GitHub preview build
- **THEN** the app requests notification permission when required
- **AND** schedules periodic release checks

#### Scenario: Newer Android preview is found

- **WHEN** an opted-in preview build finds a newer Android preview release with
  a matching APK asset
- **THEN** the app posts one update notification for that version when permitted
- **AND** tapping the notification opens that release page

#### Scenario: Unrelated or incompatible release is found

- **WHEN** the release feed contains a non-Android release, a malformed Android
  preview release, or a release no newer than the installed version
- **THEN** the app does not post an update notification for it

#### Scenario: Member disables update alerts

- **WHEN** a member disables APK update alerts
- **THEN** the app cancels periodic checks and posts no further update alerts

### Requirement: Native Android message alerts

The Android app SHALL let signed-in members opt in to unread-message alerts
through an installed UnifiedPush distributor. It SHALL request notification
permission when required, register only the current account's device, and
remove that registration on opt-out or sign-out. Tapping an alert SHALL open
the relevant conversation. The app SHALL remain usable without a distributor.

#### Scenario: Member enables alerts

- **WHEN** a signed-in member enables message alerts
- **THEN** the app requests notification permission when required
- **AND** helps the member select an installed distributor
- **AND** registers its endpoint for that member

#### Scenario: Member changes account on one device

- **WHEN** a member signs out and another member signs in on the same device
- **THEN** the previous member's registration is removed
- **AND** the new member is not registered until they opt in

#### Scenario: Member taps an unread-message alert

- **WHEN** a member taps an Android unread-message alert
- **THEN** the app opens the matching conversation after checking their session

#### Scenario: No distributor is installed

- **WHEN** the member has no UnifiedPush distributor on their device
- **THEN** native messaging remains usable and no background alert is promised

### Requirement: Opt-in native usage analytics

The Android app SHALL default to sending no native analytics, including in F-Droid builds. It SHALL offer equally accessible enable and disable controls on sign-in and Account, explain the data and destination, and persist consent locally across restarts. Consent SHALL be independent of the signed-in account.

#### Scenario: Fresh installation

- **WHEN** the app opens or navigates before consent
- **THEN** no native analytics requests are sent

#### Scenario: Member opts in

- **WHEN** the member enables usage analytics
- **THEN** subsequent foreground app opens and native top-level screen views are sent to the self-hosted Trustroots Umami endpoint
- **AND** native traffic uses `android.trustroots.org`, fixed `/android/` paths and the Android Umami website identifier `95c86802-44fe-4bff-ab54-dbe9dff27e42`
- **AND** requests contain no credentials, cookies, member data, message data, user-entered values, browser URLs or persistent identifiers

#### Scenario: Member opts out

- **WHEN** the member disables usage analytics
- **THEN** pending requests are cancelled and subsequent events are discarded
- **AND** the choice remains disabled after restarting

#### Scenario: Analytics service is unavailable

- **WHEN** delivery fails or times out
- **THEN** app navigation and authentication continue normally
- **AND** events are not persisted, retried or redirected to another host

### Requirement: Native member navigation and rotation continuity

The Android app SHALL provide labelled bottom navigation with a selected state
and unread-message indicator. Each retained top-level visit SHALL own its
nested Navigation 3 route history. Rotation and Activity recreation SHALL
preserve the active route, its supported nested history, search/map state and
unsaved form values without replaying startup.

#### Scenario: Member rotates while editing

- **WHEN** a member rotates the device while editing a profile
- **THEN** the editor and entered values remain visible without a startup screen

#### Scenario: Activity recreates in a nested destination

- **WHEN** Android recreates the Activity while a nested member destination is
  open
- **THEN** the active top-level visit and supported child route history are
  restored after the live authenticated session is available
- **AND** destination data is reloaded from its existing API as needed
- **AND** route state contains no session credentials, private message content
  or API response payloads

### Requirement: Discoverable native search and profiles

The app SHALL keep place search visible above the map, provide a search-mode
menu and toggle filters independently. Place suggestions SHALL be optional
and result statistics SHALL identify the visible map area. Host cards SHALL
open profiles and show available avatars, usernames and shared circles.
Member search SHALL show a centred empty state with search guidance
and an action to switch to map search. Both search modes SHALL use a compact
search toolbar with the mode menu inside the field. Profiles SHALL default to
About with Contacts and Experiences available through native tabs and swipe
navigation. Hosting details SHALL remain in About.

#### Scenario: Member searches and inspects a host

- **WHEN** a member searches a place and selects a host
- **THEN** a compact host card shows hosting status and available member context
- **AND** opening the card displays About before experiences

### Requirement: Clear native interaction and messaging

Circle discovery SHALL explain membership and visually distinguish joined
circles. Conversations SHALL distinguish senders with message bubbles and
separate the composer, providing an accessible send action beside the input.

#### Scenario: Member sends a message

- **WHEN** a member sends a non-empty draft
- **THEN** it appears in an outgoing bubble and the composer clears on success

### Requirement: Protect unsaved native form changes

Editable forms SHALL expose save and cancel actions and confirm before
discarding edited values through cancel, system back or primary navigation.
Saving SHALL keep the form open on failure and SHALL not allow navigation
to interrupt an in-flight save.

#### Scenario: Member cancels an edited form

- **WHEN** a member cancels or navigates away after changing form values
- **THEN** the app offers to keep editing or discard the changes
- **AND** keeping edits leaves all entered values intact

### Requirement: Screen-scoped Android member sources

Android member screen entry points and screen-specific helpers SHALL be
organised under named feature packages below `ui`, including the existing
member search, profile detail, profile editing, inbox, conversation and
contacts screens, and the integrated Circles, HostDetail, HostMap, HostOffer,
Search, Account, Experience, Menu and Startup screens. Components and helpers
shared across screen features SHALL live in `ui/common` where appropriate.
`TrustrootsApp`, `Destination`, `MemberTabVisit`, `MemberShellVisit` and the
`MemberShell` coordinator SHALL remain in the `ui` root. Source organisation
changes SHALL preserve existing rendering, navigation and route state,
ViewModel ownership and lifetime, callbacks, resources, API behaviour and UI
interactions. All existing unit and Android journey tests and their assertions
SHALL remain in place, with feature ViewModel tests located in their owning feature package and
established Android journeys retaining their integration package. Already
published serialisable route types SHALL retain their Java class names because
Navigation 3 persists those names in Android SavedState, including the existing
Menu page/browser keys and their enum values.

#### Scenario: Maintaining one member screen

- **WHEN** a contributor changes an Android member screen included in this
  source organisation
- **THEN** its entry point and screen-specific helpers reside in the owning
  feature package
- **AND** shared UI components reside in `ui/common` where appropriate
- **AND** production and test references use explicit imports for the new
  package ownership
- **AND** former files contain no forwarding screen functions or compatibility
  aliases

#### Scenario: Existing member journeys after source extraction

- **WHEN** a member uses any Android screen included in this source organisation
- **THEN** its existing rendering, navigation, state ownership, ViewModels,
  resources, API behaviour and interactions remain unchanged
- **AND** all existing unit and Android journey test methods, assertions and
  counts remain in place

#### Scenario: Restoring published Menu routes after source organisation

- **GIVEN** Android SavedState contains a supported Menu page or browser route
- **WHEN** Navigation 3 restores the stack after the source organisation
- **THEN** the original `org.trustroots.android.ui` route class names resolve
- **AND** legacy EditProfile and omitted support-link values remain supported
- **AND** translated titles, URLs and session cookies are resolved at runtime

### Requirement: Consistent Android search and filter controls

The Android circle and conversation filters and member and place searches SHALL
use fully rounded filled text fields. Live filters SHALL show a leading search
icon. Submitted searches SHALL show a trailing fully rounded theme-primary search
button and support the keyboard search action. Non-empty fields SHALL show a
Clear icon button before any search button. Field and action labels SHALL use
XML string resources, and icon buttons SHALL have accessible names and touch
targets of at least 48 dp. Existing search-mode menus SHALL remain available.

#### Scenario: Clearing a live filter

- **WHEN** a member clears the circle or conversation filter
- **THEN** the full loaded list returns immediately without another API request
- **AND** the empty field no longer shows its Clear action

#### Scenario: Clearing submitted member search

- **WHEN** a member clears the member search field
- **THEN** its results and search errors are removed without submitting a search
- **AND** a late response for the old query cannot restore results or errors
- **AND** authentication failures still invalidate the member's session

#### Scenario: Clearing place search

- **WHEN** a member clears the place search field
- **THEN** place suggestions are dismissed without submitting an empty search
- **AND** the current map, host results and filters remain in place
- **AND** a late submitted lookup cannot move the map or show an obsolete error

#### Scenario: Submitting through keyboard or button

- **WHEN** a valid search is submitted with the keyboard or the search button
- **THEN** the same search action runs
- **AND** neither action submits when the screen disables search

### Requirement: Android appearance follows system setting

The native Android app SHALL provide readable light and dark colour schemes
whose brand palette is defined in Android XML resources and SHALL follow the
system appearance setting. Native surfaces, text, controls and system bars
SHALL remain legible in either appearance, without automatic platform
force-dark transformation. Host map result cards SHALL remain white in both
appearances and SHALL use colours that keep their content legible on white.

#### Scenario: System uses light appearance

- **WHEN** Android is configured for light appearance
- **THEN** the app presents its Trustroots light palette and matching system
  bar colours
- **AND** representative native screens and controls have readable text and
  surfaces

#### Scenario: System uses dark appearance

- **WHEN** Android is configured for dark appearance
- **THEN** the app presents its Trustroots dark palette and matching system
  bar colours
- **AND** representative native screens and controls have readable text and
  surfaces without platform force-dark transformation

#### Scenario: Host result appears in dark appearance

- **WHEN** a member views a host result card while Android uses dark appearance
- **THEN** the card surface remains white
- **AND** its text and controls remain readable against that white surface

#### Scenario: System appearance changes while the app is open

- **WHEN** Android appearance changes from light to dark or dark to light
- **THEN** the app updates its theme and system bars to match the new system
  appearance without discarding the current screen or entered form values

### Requirement: Consistent Android member form fields

Editable member forms and the conversation composer SHALL use Material 3 filled
text fields with consistent spacing between vertically adjacent fields. Field
labels and accessibility text SHALL come from Android string resources. The
presentation change SHALL preserve existing field values, validation, focus
and keyboard behaviour, disabled and loading states, and unsaved-change guards.
Search and filter inputs are outside this requirement.

#### Scenario: Member edits a form

- **WHEN** a member opens profile editing, hosting, experience or account
  fields
- **THEN** editable fields use the filled presentation and consistent vertical
  spacing
- **AND** labels remain accessible through Android string resources
- **AND** entering and saving values follows the existing validation and
  navigation behaviour

#### Scenario: Member writes a conversation message

- **WHEN** a member focuses the conversation composer and enters a message
- **THEN** the composer uses the filled presentation with an accessible label
- **AND** focus, keyboard and send behaviour remain unchanged

#### Scenario: Profile save fails

- **WHEN** saving an edited profile fails
- **THEN** the failure message remains visible independently of the form's
  scroll position
- **AND** the entered values remain available for another save attempt

### Requirement: Android sign-in state and rotation continuity

The Android sign-in screen SHALL render an immutable state exposed by a
screen-scoped ViewModel and SHALL send user actions to that ViewModel as
explicit events. An Activity-retained holder SHALL preserve the sign-in
destination store across Activity recreation and SHALL clear it when the
destination exits. Username, password, loading state, sign-in errors and any
pending successful result SHALL remain in memory only; credentials SHALL NOT
be persisted to disk or process-restoration state. A successful result SHALL
be delivered to the app-level session callback and acknowledged without being
lost when the Activity recreates during the request. A new sign-in destination
after sign-out or session expiry SHALL start with fresh fields and its current
signed-out message. Sign-in SHALL retain the existing API request, username
correction, progress and error behaviour, encrypted session persistence
callback, browser destinations, analytics tracking, and keyboard-aware form
and footer behaviour.

#### Scenario: Member rotates while entering credentials

- **WHEN** a member rotates the device while editing the sign-in form
- **THEN** the entered username and password remain available in the form
- **AND** the sign-in form's current loading and error state is retained

#### Scenario: Sign-in fails and credentials are corrected

- **WHEN** a sign-in request fails
- **THEN** the form stops showing progress and displays the existing failure
  feedback
- **AND** the member can edit either field and submit again

#### Scenario: Member signs out and opens sign-in again

- **WHEN** a member signs out or their session expires and they return to
  sign-in
- **THEN** the sign-in destination uses a new state store with empty fields
- **AND** it shows the current session-expiry message when one is supplied
- **AND** it does not replay a successful result from the previous session

#### Scenario: In-flight sign-in request survives Activity recreation

- **WHEN** the Activity recreates while a sign-in request is in flight
- **THEN** the request remains owned by the retained sign-in destination
  store
- **AND** the recreated screen observes the result and opens the signed-in
  shell with the returned session

#### Scenario: Sign-in succeeds

- **WHEN** the API returns a valid member session
- **THEN** the existing parent callback persists the encrypted session and
  opens the signed-in shell

#### Scenario: Member uses the sign-in keyboard or footer

- **WHEN** the on-screen keyboard is shown on the sign-in screen
- **THEN** the recent keyboard-aware scrolling, submission action, and footer
  placement remain usable

### Requirement: Android app session lifecycle

The Android app SHALL own secure-session restoration and signed-in/signed-out
transitions in an Activity-scoped state owner. `TrustrootsApp` SHALL render
navigation from that owner's state rather than owning session loading,
persistence or sign-out/invalidation state itself. The session cookie SHALL
remain runtime-only outside the existing encrypted `SecureMobileSessionStore`.

#### Scenario: Initial restore

- **WHEN** a new Activity-scoped session owner starts without an in-memory
  result
- **THEN** it reads `SecureMobileSessionStore` once on an IO dispatcher
- **AND** an absent or unreadable stored session resolves to signed out
- **AND** Startup is displayed for at least 700 ms measured from the start of
  restoration, unless restoration itself takes longer
- **AND** a valid stored session is used without an additional remote
  validation request before the authenticated shell is shown

#### Scenario: Activity recreation

- **WHEN** the Activity is recreated while restoration is in progress or after
  a session is loaded
- **THEN** the Activity-scoped owner retains the in-flight operation or current
  in-memory state
- **AND** Compose recreation does not restart restoration or the minimum-delay
  timer
- **AND** the session cookie is not copied to Android saved state

#### Scenario: Sign in and member update

- **WHEN** sign-in succeeds or the authenticated member is updated
- **THEN** the owner calls the existing secure-store save operation before
  publishing the new in-memory session
- **AND** save and state publication remain synchronous within the existing
  main-thread callback, without an asynchronous gap that permits another
  sign-in submission
- **AND** a member update preserves the existing session cookie
- **AND** successful sign-in clears signed-out feedback and sign-in browser
  destination state
- **AND** persistence retains the existing encrypted payload and
  `SharedPreferences.apply()` semantics

#### Scenario: Explicit sign out

- **WHEN** the member signs out
- **THEN** the app clears that member's response cache using the current
  normalised backend URL and username
- **AND** cache, store and owner cleanup remain synchronous in the existing
  main-thread callback order
- **AND** it clears the stored session, sign-in destination and authenticated
  shell entry stores before publishing signed-out state
- **AND** no session-expired message is shown for explicit sign-out

#### Scenario: Authentication invalidation

- **WHEN** an authenticated route reports that the session is invalid
- **THEN** the app performs the same cache, store and navigation-owner cleanup
  as explicit sign-out
- **AND** it publishes the existing session-expired feedback for the sign-in
  screen
- **AND** a subsequent successful sign-in clears that feedback

#### Scenario: Backend replacement

- **WHEN** the active backend URL changes
- **THEN** the sign-in navigation owner clears its destination as it does today
- **AND** a signed-in session is not cleared or rewritten solely because the
  backend changed
- **AND** authenticated entry ViewModels receive the new API environment and
  retain their existing request cancellation/reload behaviour

#### Scenario: Stale authenticated callback

- **WHEN** a member-update, sign-out or invalidation callback arrives from a
  previously active account, cookie or backend
- **THEN** the owner ignores it and retains the current session
- **AND** it does not clear the current account cache, persisted session or
  navigation stores
- **AND** an invalidation callback received after sign-out does not publish
  session-expired feedback

#### Scenario: Activity owner is cleared

- **WHEN** the Activity-scoped session ViewModel is finally cleared
- **THEN** it cancels restoration and drops its in-memory session and feedback
- **AND** it does not clear the persisted session or response cache
- **AND** late callbacks cannot save a session or change runtime state after
  the owner has been cleared
- **AND** a later Activity owner can restore the still-persisted session

#### Scenario: Credential and route boundary

- **WHEN** the app saves or restores navigation and session state
- **THEN** the cookie is present only in live `MemberSession` memory and the
  existing encrypted session store
- **AND** it is absent from Navigation 3 keys and Android saved-state bundles
- **AND** the route graph remains responsible only for navigation identifiers
  and non-secret UI state

### Requirement: Formatted Android circle descriptions

Android circle details SHALL render the supported rich-text structure from the
existing circle description field. Supported structure SHALL include
paragraphs, line breaks, unordered lists, bold and italic emphasis, underlining,
and blockquotes. Link labels and their supported child formatting SHALL remain
visible, but user-written links SHALL NOT be clickable. Description markup
SHALL NOT load images or embedded content. Circle filtering SHALL continue to
search the visible description text.

#### Scenario: Member views a formatted circle description

- **WHEN** a member opens a circle whose description contains supported rich
  text
- **THEN** the detail displays its paragraph, list, and inline emphasis
  structure
- **AND** the circle membership action remains reachable by scrolling

#### Scenario: Description contains a link

- **WHEN** a circle description contains an anchor with a label
- **THEN** Android displays the label and any supported child formatting
- **AND** activating the label does not navigate away from the circle detail

#### Scenario: Member filters by formatted description text

- **WHEN** a member filters circles using text inside a formatted description
- **THEN** the matching circle remains discoverable without exposing raw markup

### Requirement: Collapsing Circles headers

The native Android Circles overview and circle detail screens SHALL collapse
their expanded headers into a compact single-row app bar as the member scrolls.
The compact row SHALL retain the screen title and the relevant navigation
action, and overview and detail titles SHALL use consistent typography. The
overview filter SHALL retain its current query and clear behaviour. Circle
description formatting, inert links, membership controls, API and loading
state, and Back navigation SHALL continue to work. The layout SHALL respect
system and shell insets, right-to-left layout, accessible labels and touch
targets, and the active light or dark theme.

#### Scenario: Member scrolls the Circles overview

- **WHEN** a signed-in member scrolls the Circles overview
- **THEN** the expanded header collapses into a single-row title app bar
- **AND** the current filter query and clear action remain functional
- **AND** circle rows remain reachable above the system and app navigation

#### Scenario: Member scrolls circle details

- **WHEN** a member scrolls a circle's detail screen
- **THEN** the artwork header collapses into a single-row app bar showing the
  circle title and Back action
- **AND** the description and membership action remain reachable
- **AND** supported description formatting remains visible while its links
  remain inert

#### Scenario: Member returns from collapsed circle detail

- **WHEN** a member activates Back from circle detail after scrolling
- **THEN** the Circles overview is restored
- **AND** the current filter query remains intact

#### Scenario: Collapsing headers render across device settings

- **WHEN** the overview or detail header is expanded or collapsed
- **THEN** it respects system and shell insets in left-to-right and
  right-to-left layouts
- **AND** title and navigation controls remain accessible and usable in light
  and dark themes

### Requirement: Navigation 3 owns Android top-level member navigation

The authenticated Android member shell SHALL use Navigation 3 to own and
render its Circles, Search, Messages and Profile top-level navigation
history. Each visit SHALL have a unique entry identity, including repeated
visits to the same destination, and SHALL own its child route stack. Nested
routes SHALL remain above the route that opened them so Back restores that
exact origin and its retained state. After the parent has loaded the live
authenticated session, the active destination SHALL be restorable after
Activity recreation. Top-level and nested route keys SHALL be serialisable and
contain only route identity and the minimum stable public identifier needed to
reload a destination; they SHALL NOT contain session credentials, cookies,
account secrets or API payloads. The live authenticated parent SHALL remain
the source of session and member data.

#### Scenario: Member switches between top-level destinations

- **WHEN** a member selects a different top-level destination
- **THEN** Navigation 3 records a new uniquely identified visit after the
  current one
- **AND** Back returns to the previous destination in the member's navigation
  history

#### Scenario: Member opens a nested destination from different origins

- **WHEN** a member opens a circle, host detail, profile, conversation,
  browser page or form from its available source routes
- **THEN** Navigation 3 places the destination above its exact originating
  route within that top-level visit
- **AND** Back restores that origin and its retained state
- **AND** the route key contains no destination payload or session data

#### Scenario: Member revisits a prior destination

- **WHEN** a member navigates Circles → Messages → Circles
- **THEN** the stack retains three distinct destination visits
- **AND** Back returns to Messages and then to the original Circles visit

#### Scenario: Member reselects the current destination

- **WHEN** a member selects the currently active top-level destination
- **THEN** the established destination reset behaviour runs
- **AND** no duplicate destination is added to navigation history

#### Scenario: Member opens a destination from a message alert

- **WHEN** an alert requests a conversation for the currently signed-in
  account
- **THEN** the member shell selects Messages and opens the requested
  conversation through its existing screen navigation state
- **AND** Back follows the existing origin history after leaving the
  conversation

#### Scenario: Member cancels predictive Back

- **WHEN** a member starts and cancels a predictive Back gesture at the
  top-level shell
- **THEN** the current destination and its navigation history remain intact

#### Scenario: Member completes predictive Back

- **WHEN** a member completes a predictive Back gesture at the top-level shell
- **THEN** exactly the current destination visit is removed
- **AND** its previous destination becomes active

#### Scenario: Activity is recreated in an authenticated destination

- **WHEN** Android recreates the activity while the member is using a
  top-level destination
- **THEN** after the parent restores the live session, saved navigation state
  restores the active safe destination and its distinct visit history
- **AND** authentication is still obtained from the live session store
- **AND** no session credential or member-specific secret is restored from a
  navigation key

### Requirement: Navigation 3 preserves native leave and nested Back behaviour

Navigation 3 Back handling SHALL preserve existing menu-page,
embedded-browser and nested-screen Back behaviour. Back SHALL dismiss transient
presentation state first, then traverse available WebView history, then pop
the active child route before the top-level history. A dirty editable form
SHALL be offered the existing keep-editing or discard decision before any
route push, route pop, browser close or top-level navigation action commits.
Cancelling predictive Back SHALL NOT commit a pop or bypass the leave decision.

#### Scenario: Member backs out of a nested menu page

- **WHEN** a member presses Back while a menu subpage or embedded browser is
  open
- **THEN** the nested page or browser closes before the top-level history is
  popped

#### Scenario: Browser history is traversed before its route closes

- **WHEN** a member presses Back in an embedded browser with WebView history
- **THEN** Back first traverses that browser history
- **AND** a later Back closes the browser route and restores its exact source
  entry

#### Scenario: Profile contact request uses a safe browser route

- **WHEN** a member opens the contact-request page from a profile
- **THEN** its browser route keeps the source profile beneath it and records
  only the purpose, public member ID and visit identity
- **AND** its localised title, URL and current session cookie are supplied at
  runtime
- **AND** Back traverses WebView history before returning to the same profile

#### Scenario: Member leaves a dirty nested form

- **WHEN** a member attempts a nested route change, browser close, Back pop or
  top-level navigation while a form has unsaved changes
- **THEN** the existing leave guard asks whether to keep editing or discard
- **AND** keeping edits leaves the current route and all stack entries intact
- **AND** confirming discard performs the pending navigation once

#### Scenario: Member leaves a dirty form through top-level navigation

- **WHEN** a member selects another top-level destination while a form has
  unsaved changes
- **THEN** the existing leave guard asks whether to keep editing or discard
- **AND** keeping edits leaves the form and top-level destination unchanged

### Requirement: Navigation-scoped Android Circles state

The Android Circles screen SHALL keep catalogue, membership, filter and
selected-detail state in a ViewModel scoped to its Navigation 3 entry. The
ViewModel SHALL use immutable UI state and explicit user events, and its data
operations SHALL be injectable for deterministic tests. It SHALL NOT place
session cookies in UI state, saved state or navigation keys. Removing the
navigation entry or signing out SHALL clear its account-scoped state and cancel
its outstanding work.

#### Scenario: Member temporarily leaves Circles

- **WHEN** a member navigates to another tab while the Circles entry remains
  on the back stack
- **THEN** returning to Circles restores its loaded catalogue, membership
  state, filter and selected detail
- **AND** it does not repeat successful initial reads solely because of the
  temporary departure

#### Scenario: Member explicitly reselects Circles

- **WHEN** a member reselects the active Circles tab
- **THEN** the screen returns to the overview with an empty filter
- **AND** clears transient errors and membership-update state
- **AND** reloads the catalogue and memberships

#### Scenario: Circles entry is removed

- **WHEN** Navigation 3 removes a Circles entry from the back stack
- **THEN** its ViewModel is cleared and outstanding requests are cancelled
- **AND** a later Circles entry starts with fresh state

#### Scenario: Circle catalogue load fails and is retried

- **WHEN** loading circles or memberships fails for a reason other than an
  expired session
- **THEN** the screen shows the existing error and a Retry action
- **AND** Retry reloads both data sources without losing the current filter or
  selected detail
- **AND** a failed catalogue is not presented as a successful empty catalogue

#### Scenario: Member session expires during a Circles request

- **WHEN** a catalogue, membership or membership-update request reports an
  authentication failure
- **THEN** the ViewModel emits one identified invalidation event
- **AND** the existing parent session callback is delivered once and the event
  is acknowledged

#### Scenario: An obsolete Circles request completes

- **WHEN** a request is cancelled, superseded by a retry, or belongs to a
  previous account scope
- **THEN** its result does not overwrite the current screen state

#### Scenario: Member opens circle detail and presses Back

- **WHEN** a member opens a circle from a filtered overview and returns with
  Back
- **THEN** the selected detail is cleared
- **AND** the current overview filter and loaded data remain available

#### Scenario: Circle detail owns its visit and returns membership changes

- **WHEN** a member opens a circle from a filtered, scrolled Circles overview
  and changes membership in its detail route
- **THEN** the detail entry loads canonical circle data by its public slug and
  owns its membership request and result
- **AND** Back restores the same overview visit, filter and scroll position
  with the changed membership reflected without reloading the catalogue
- **AND** Activity recreation restores the supported detail route from its
  slug and visit identity

### Requirement: Collapsing Android message headers

The Android Messages overview and conversation detail SHALL use consistent
Material 3 large app bars that collapse to a single title row as their content
scrolls. Both states SHALL use the established Material title typography. The
app bars SHALL respect the screen's supplied insets and expose an accessible
Back action on conversation detail.

#### Scenario: Member scrolls the Messages overview

- **WHEN** a member scrolls the conversation list
- **THEN** the Messages title collapses to one app-bar row
- **AND** the conversation filter remains a live local filter while visible
- **AND** conversation rows retain their full-row open action and Profile action

#### Scenario: Member scrolls a conversation

- **WHEN** a member scrolls the message history
- **THEN** the participant title collapses to one app-bar row
- **AND** the Back and available View profile actions remain accessible
- **AND** the quick replies and message composer remain usable above the IME

#### Scenario: Member returns to the top of message content

- **WHEN** a member scrolls the overview or conversation content back toward its
  start
- **THEN** the corresponding large app bar expands again
- **AND** existing filter state, message position, drafts and navigation origin
  remain intact

### Requirement: Stable native Android profile frame

The Android member profile SHALL use one shared artwork header with section
tabs. The artwork and scrim SHALL extend behind the profile action area to the
top system inset, with controls remaining readable over the artwork. The
action area SHALL keep Back on the left and, for another member's profile, a
primary Send a message action on the right. Experience-sharing and contact
actions SHALL be reachable from an accessible overflow menu. A member's own
profile SHALL retain its edit action. Existing contact relationship states,
add-contact routing, and remove confirmation SHALL be preserved. The header
and tabs SHALL remain outside the `HorizontalPager`, which contains only
scrollable section content. Tab selection and pager swipes SHALL stay
synchronised. The avatar SHALL retain a minimum 48 dp touch target. On compact
screens, the header SHALL use a horizontal avatar and text layout and preserve
usable section space after system insets. At full collapse, the artwork header
SHALL occupy one inset-aware action row; the tabs SHALL clip out of view with
the artwork. Scrolling back toward the start SHALL expand the artwork and
reveal the tabs again. Pager swipes SHALL continue to change sections while
the tabs are clipped, and each section's scroll position SHALL be preserved.

#### Scenario: Member opens another member's profile

- **WHEN** a member views another member's profile
- **THEN** Back is available on the left and Send a message is the primary
  action on the right
- **AND** experience sharing and the applicable contact action are available
  from an accessible overflow menu
- **AND** the artwork continues behind the action area up to the top system
  inset

#### Scenario: Member scrolls a profile section

- **WHEN** a member scrolls the About, Contacts or Experiences content down to
  full collapse
- **THEN** the artwork header collapses to one inset-aware action row
- **AND** the tabs clip out of view with the artwork while remaining outside
  the pager
- **AND** Back and the applicable profile actions remain available
- **AND** only the current section content scrolls
- **AND** scrolling back toward the start expands the artwork and reveals the
  tabs again

#### Scenario: Member swipes between profile sections

- **WHEN** a member swipes the section pager while the tabs are visible or
  clipped by a fully collapsed artwork header
- **THEN** the newly selected section is shown and its scroll position is
  preserved
- **AND** its tab is selected when the tabs are visible
- **AND** the shared artwork frame remains in one place

#### Scenario: Member sees section tabs over the profile artwork

- **WHEN** a member views a loaded profile or scrolls its content toward the
  start
- **THEN** the section tabs are inside the artwork header and outside the
  pager
- **AND** the profile background image and scrim continue behind the tabs
- **AND** the tabs remain legible against the scrim

#### Scenario: Member manages a contact relationship from the profile

- **WHEN** the contact relationship is loading, absent, pending or confirmed
- **THEN** the overflow menu reflects the existing applicable contact action
- **AND** add-contact routing and removal confirmation retain their existing
  behaviour

#### Scenario: Member opens their own profile

- **WHEN** a member views their own profile
- **THEN** the edit action remains available
- **AND** message, experience-sharing and contact actions for other members
  are not presented

#### Scenario: Member opens a profile in a compact viewport

- **WHEN** the profile viewport is 360 dp tall with a 24 dp top inset and an
  80 dp bottom inset
- **THEN** the shared artwork header, action area and tabs leave at least
  96 dp available for scrollable section content
- **AND** the artwork reaches behind the action area and top inset

#### Scenario: Member opens a profile in a shorter viewport

- **WHEN** the profile viewport is 320 dp tall with a 24 dp top inset and an
  80 dp bottom inset
- **THEN** at least 48 dp remain available for scrollable section content
- **AND** the avatar and action controls retain their minimum touch targets

#### Scenario: Profile is loading or fails to load

- **WHEN** the profile request is pending or fails
- **THEN** the loading or error state remains available without a partial
  interactive profile frame

#### Scenario: Member opens and closes the profile photo viewer

- **WHEN** a member opens a profile photo and then closes the viewer
- **THEN** the existing image-viewer state and callbacks are preserved
- **AND** the same profile and selected section remain visible

### Requirement: Full-screen profile photo viewer

The Android app SHALL let a member open a profile photo in a native, black,
full-screen viewer. Only after opening, the viewer SHALL lazily request the
largest existing avatar rendition (2048 pixels) through the existing
session-aware artwork transport and cache, accepting renditions up to the
server's existing 8 MiB avatar limit. It SHALL preserve the decoded
image's aspect ratio without cropping. Its initial scale SHALL be the smaller
of the scales needed to fit the decoded bitmap within the usable viewer bounds
and `1.0`; therefore, small images are never enlarged. Pinch zoom SHALL range
from this initial scale up to `1.0` decoded source image pixel per physical
display pixel, calculated with display density accounted for. Panning SHALL
remain within the image bounds, and returning to the minimum zoom SHALL restore
the initial fit and centred position.

The viewer SHALL account for system bars and display cut-outs, use a black
background with white status and navigation bar icons in both light and dark
system appearances, and restore the prior window appearance when closed. It
SHALL expose an accessible image description and accessible zoom/reset
actions, and provide a close control with at least a 48dp touch target. System Back and the close
control SHALL close the viewer and return to the same profile and profile
section. Image loading and decoding SHALL not block navigation or invalidate
the member session.

#### Scenario: Member opens a profile photo

- **WHEN** a member activates the profile photo
- **THEN** the viewer requests the 2048-pixel avatar rendition only after it is
  opened, using the current profile session
- **AND** the whole image is centred on black and initially fitted within the
  usable bounds without upscaling based on the decoded bitmap's actual pixel
  dimensions

#### Scenario: Member zooms into a profile photo

- **WHEN** a member pinches to zoom or uses an accessible zoom action
- **THEN** the image can be enlarged up to one decoded source pixel per physical
  display pixel
- **AND** panning cannot reveal empty space beyond the image
- **AND** returning to minimum zoom restores the initial fit

#### Scenario: Member closes the viewer

- **WHEN** a member activates the close control or Android system Back
- **THEN** the viewer closes
- **AND** the same profile and selected profile section are visible

#### Scenario: Profile photo is loading or unavailable

- **WHEN** the photo request is pending, fails, or cannot reach the server
- **THEN** the viewer keeps an accessible close control available
- **AND** presents a non-blocking loading or error state
- **AND** the member can continue using the app without being signed out
- **AND** previously cached imagery MAY be shown when available, but persistent
  offline image availability is not promised

### Requirement: Collapsing headers on remaining member destinations

The Android Profile destination, Contacts overview, Account screen, and own
and member profile screens SHALL compact their tall headers as the member
scrolls, leaving more space for the active content. Back navigation and
existing screen actions SHALL remain available and retain their current
behaviour. Header and content layout SHALL respect the supplied system insets.

#### Scenario: Member scrolls the Profile destination

- **WHEN** a member scrolls the Profile destination
- **THEN** the `Profile` title compacts into a persistent app bar
- **AND** the member identity and destination links remain available in the
  scrollable content

#### Scenario: Member scrolls Contacts or Account

- **WHEN** a member scrolls the Contacts overview or Account screen
- **THEN** the screen header compacts to make more vertical room for its content
- **AND** Back remains reachable
- **AND** Account form values, dirty-state guard, and in-flight save behaviour
  remain unchanged

#### Scenario: Member scrolls their own profile

- **WHEN** a member scrolls their own profile
- **THEN** the profile artwork header compacts while the edit action remains
  available
- **AND** the member name and edit action share a single compact row above
  the fixed profile tabs
- **AND** the selected profile section and its scroll position are preserved

#### Scenario: Member scrolls another member's profile

- **WHEN** a member scrolls another member's profile
- **THEN** the artwork continues behind the status inset and profile action
  area as the frame compacts
- **AND** the member name and actions share a single compact row above the tabs
- **AND** Back remains on the left and Send a message remains the primary
  action on the right
- **AND** applicable contact and experience actions remain available through
  the overflow menu
- **AND** profile tabs remain fixed outside the pager, over the artwork, and
  synchronised with pager swipes

#### Scenario: Member views a profile with system insets

- **WHEN** a member opens or scrolls a profile with status or navigation
  insets
- **THEN** the artwork, actions, tabs, and content avoid duplicate or missing
  inset space
- **AND** action touch targets remain accessible

### Requirement: Entry-scoped Android contacts state

The Android Contacts screen SHALL keep its loaded list, request status and
retryable failure with the Navigation 3 entry that owns the Contacts page.
Loading the signed-in member profile to obtain its ID and loading contacts
SHALL be coordinated by an injectable screen ViewModel. The ViewModel SHALL
ignore stale request completions, cancel work when its entry is removed, and
deliver session invalidation once. ViewModel state and saved navigation state
SHALL not contain session credentials.

#### Scenario: Contacts load succeeds and the member returns from a profile

- **WHEN** a member opens a contact profile and then presses Back
- **THEN** the Contacts list and its state remain available
- **AND** the successful contacts request is not repeated

#### Scenario: Contacts load fails and can be retried

- **WHEN** a profile or contacts request fails without invalidating the session
- **THEN** the Contacts screen shows the existing failure text and a retry action
- **AND** retry starts a fresh request and replaces any stale result

#### Scenario: Contacts request invalidates the session

- **WHEN** either Contacts request returns an authentication failure
- **THEN** the existing session-invalidated callback runs once
- **AND** the authenticated shell clears the Contacts entry state

#### Scenario: Contacts entry is removed

- **WHEN** the owning Navigation 3 entry is removed while a request is active
- **THEN** its request is cancelled and its Contacts state is cleared

### Requirement: Localised API and screen failure fallbacks

The Android member application SHALL represent app-generated API and
screen-specific fallback failures using stable identifiers and optional
nonblank server-provided text. API and ViewModel layers SHALL remain independent
of Android resources and SHALL NOT retain translated strings in failure state.
Composable UI SHALL resolve fallback identifiers through the active Android
string resources. A nonblank server-provided error message SHALL continue to
take precedence and be displayed verbatim. Existing English default wording
SHALL remain the default resource copy, not a fabricated API exception message
retained for internal-test compatibility. API diagnostics MAY use
machine-readable codes.

#### Scenario: Server supplies an error message

- **WHEN** an API request fails and the response contains a nonblank message
- **THEN** the Android UI displays that server-provided message
- **AND** it does not replace it with the local fallback resource

#### Scenario: API response omits a rejection message

- **WHEN** sign-in is rejected or another request receives an error response
  without a nonblank message
- **THEN** the API result carries the corresponding context-free failure
  identifier
- **AND** the UI displays the matching string resource for the current locale
- **AND** the API failure carries no fabricated English fallback message

#### Scenario: Successful sign-in response omits a member session

- **WHEN** a successful sign-in response has no member session cookie
- **THEN** the API result identifies the `MissingSession` fallback
- **AND** the UI resolves its message using the active locale's resource

#### Scenario: Error state is owned by an integrated ViewModel

- **WHEN** `SignInViewModel`, `CirclesViewModel`, `MemberSearchViewModel`, or
  `ContactsViewModel` retains a failure across a recomposition or configuration
  change
- **THEN** it retains the failure kind and optional nonblank server text
- **AND** the UI resolves fallback copy from the currently active resources

#### Scenario: Locale changes while an error is retained

- **WHEN** the Android resource configuration changes while a fallback failure
  remains in UI or ViewModel state
- **THEN** the failure continues to carry its identifier and optional server
  text
- **AND** the UI displays the fallback in the newly active locale

### Requirement: Localised unknown member label

The Android API member models SHALL retain server-derived display names and
usernames without embedding translated fallback copy. Compose presentation
SHALL use the existing `profile_photo_default_member_label` string resource
when neither a nonblank display name nor a username is available.

#### Scenario: Member payload has no usable name

- **WHEN** a member has a blank display name and no username
- **THEN** the UI displays the default member label from the active Android
  string resources
- **AND** the API model remains independent of Android resources

### Requirement: Navigation-scoped Android Host Offer state

The Android Host offer editor SHALL keep its load, editable form, validation,
save transaction and outcome state in a ViewModel scoped to its existing
Navigation 3 menu entry. The ViewModel SHALL expose immutable UI state and
explicit events and SHALL use an injectable repository. The repository SHALL
load the member profile before the accommodation offer and SHALL normalise
offer HTML into trimmed editable text outside the ViewModel. The ViewModel
SHALL preserve the existing offer defaults, validation and save payload. It
SHALL retain no session credential or translated fallback string in UI or
saved state. API failures SHALL retain nonblank server text and failure kind
until Compose resolves an XML fallback at render time. Removing the menu entry
or signing out SHALL cancel its outstanding work and clear its state.

#### Scenario: Member opens an existing Host offer

- **WHEN** the Host offer entry loads the signed-in member's profile and
  accommodation offer successfully
- **THEN** the existing offer values are shown as editable plain text
- **AND** HTML markup is decoded and trimmed before it reaches the form
- **AND** the original complete offer is retained as the dirty-form baseline

#### Scenario: Member starts with no Host offer

- **WHEN** the profile and accommodation-offer reads succeed and no offer
  exists
- **THEN** availability defaults to `yes`, descriptions are empty, maximum
  guests is `1`, show-only-in-my-circles is false, and the existing default
  coordinates are used
- **AND** the form is not treated as a failed load

#### Scenario: Host offer load fails

- **WHEN** either the profile read or offer read fails for a reason other than
  authentication
- **THEN** the form remains in a failed-load state and is not presented as a
  new offer
- **AND** Retry repeats the profile-then-offer sequence
- **AND** a nonblank server message is shown when present; otherwise an API-kind
  or Host-offer XML fallback is resolved at render time

#### Scenario: Member edits and validates a Host offer

- **WHEN** the member edits availability, descriptions, maximum guests or the
  circle-only setting
- **THEN** dirty state compares the current complete offer with the loaded or
  last-saved baseline
- **AND** hosting availability requires at least five trimmed description
  characters while `no` availability does not
- **AND** maximum guests remains constrained to the existing range of 1–20

#### Scenario: Member saves a Host offer

- **WHEN** the member saves a valid form
- **THEN** exactly one immutable snapshot of all current fields is submitted
- **AND** a successful response updates the offer ID and saved baseline from
  that snapshot
- **AND** translated success text is resolved from XML when displayed

#### Scenario: Host offer save fails

- **WHEN** saving fails for a reason other than authentication
- **THEN** the form values and dirty baseline remain available for another
  attempt
- **AND** the error retains nonblank server text and API failure kind until
  render-time XML fallback resolution

#### Scenario: Member leaves a changed Host offer

- **WHEN** the member uses Cancel, system or predictive Back, or top-level
  navigation with unsaved changes
- **THEN** the existing keep-editing or discard decision is shown
- **AND** keeping edits preserves the Host entry and all entered values
- **AND** an in-flight save blocks navigation until it completes

#### Scenario: Activity is recreated during Host offer work

- **WHEN** Android recreates the Activity while Host offer loading or saving is
  in progress
- **THEN** the entry-scoped ViewModel retains its form and transaction state
- **AND** the same operation completes without a duplicate profile, offer or
  save request

#### Scenario: Host offer entry is removed

- **WHEN** Navigation 3 removes the Host menu entry or the member signs out
- **THEN** its ViewModel cancels outstanding work and clears its form state
- **AND** a later Host entry starts fresh from the live authenticated session

### Requirement: Account settings state is owned by its Menu visit

The Android Account page SHALL expose account, password, message-alert and
preview-update state from one ViewModel owned by its decorated
`MenuPageVisit(MenuPage.Account, visitID)` entry. The ViewModel SHALL use
immutable context-free state, explicit events and injectable account/platform
settings boundaries. It SHALL preserve the existing account APIs, dirty-form
guard, notification permission flow, preview-update behaviour, reset-password
navigation and sign-out ordering. Android permission launchers, Activity-bound
UnifiedPush selection and external URL launching SHALL remain in the UI
adapter and SHALL communicate through identified, acknowledged effects.

The Account entry MAY retain safe drafts while it remains on the Menu back
stack and across Activity recreation. A recreated Activity SHALL NOT by itself
repeat an account read or a completed platform side effect. A new Account visit
SHALL create fresh state and load the account once. The ViewModel SHALL cancel
its work and clear account-owned in-memory state when its entry is removed. It
SHALL NOT persist a member session, cookie, `MobileApiClient`, password, email
draft, account response, `Context`, `Activity` or platform object in route
keys, saved state or persistent storage. Password inputs SHALL be cleared on
successful password change and when the ViewModel is cleared. User-facing
status labels SHALL be resolved from Android resources at the UI boundary.

#### Scenario: Account visit loads once and survives Activity recreation

- **WHEN** a member opens Account and Android recreates the Activity while the
  Account visit remains on the Menu back stack
- **THEN** the Account entry retains its safe form and status state
- **AND** account details are not fetched a second time solely because the
  Activity was recreated
- **AND** no completed permission, external-link or sign-out effect is
  dispatched again

#### Scenario: Member saves account settings or changes password

- **WHEN** a member submits changed email/newsletter settings or a valid
  current/new/verification password form
- **THEN** the Account ViewModel runs the existing API operation once and
  publishes success or a context-free typed failure
- **AND** obsolete or cancelled responses do not overwrite newer state
- **AND** a successful password change clears all password inputs

#### Scenario: Member leaves Account with a dirty form

- **WHEN** the member uses toolbar Back, system Back or opens Reset Password
  while account or password fields are dirty
- **THEN** the existing discard guard is shown
- **AND** confirming performs the selected navigation action while cancelling
  keeps the Account visit and its current drafts
- **AND** the guard prevents leaving while an account or password save is active

#### Scenario: Member changes notification settings

- **WHEN** the member enables message or preview-update notifications on a
  device that requires runtime permission
- **THEN** the ViewModel emits one identified permission effect and the Compose
  Activity Result launcher requests permission
- **AND** the permission outcome is delivered as an explicit event without the
  ViewModel retaining an Activity
- **AND** denial, retry, UnifiedPush selection and setting status retain their
  existing user-visible semantics without replay after Activity recreation

#### Scenario: Preview update is checked and opened

- **WHEN** the member requests an update check or chooses an available release
- **THEN** the Account ViewModel owns the check generation, cancellation and
  typed result state
- **AND** the UI opens the release URL at most once for the acknowledged effect
- **AND** translated status labels are resolved from Android resources

#### Scenario: Account request invalidates the session or member signs out

- **WHEN** an account request reports authentication failure or the member
  signs out
- **THEN** the Account owner delivers one identified session-invalidated or
  signed-out effect to the existing shell
- **AND** sign-out preserves the existing message-alert disable then API
  sign-out ordering
- **AND** removing the authenticated shell clears the Account entry and
  cancels its work

#### Scenario: Account entry is removed or process state is restored

- **WHEN** the Account visit is removed by Back, Menu reselection or shell
  removal, or a process is restored without its in-memory ViewModel
- **THEN** removed-entry work is cancelled and its password values are cleared
- **AND** a new Account model fetches current server details instead of
  restoring account responses, cookies or password drafts from saved state

### Requirement: Navigation-scoped Android messaging state

The Android Inbox and Conversation screens SHALL keep their business state in
separate immutable-state ViewModels scoped to their own Navigation 3 route
entries. Their API and draft operations SHALL be injectable for deterministic
tests. The Inbox route SHALL remain below a Conversation route so returning
from a conversation restores the same inbox visit. The ViewModels SHALL NOT
place session cookies or session objects in UI state, route keys, saved state
or persistent draft keys.

The Conversation ViewModel SHALL resolve its recipient independently of the
Inbox ViewModel using the authenticated existing mini-user endpoint and its
stable member ID. Profile route keys SHALL carry the public username required
by the existing profile loader. Inbox and Conversation state SHALL remain
owned by their respective decorated entries.

#### Scenario: Member temporarily leaves the Messages tab

- **WHEN** a member switches to another top-level tab while a Messages visit
  remains on the back stack
- **THEN** the Inbox filter and loaded threads remain available
- **AND** an open Conversation retains its messages, draft and send state
- **AND** returning does not repeat successful loads solely because of the
  temporary tab change

#### Scenario: Member returns from a conversation

- **WHEN** a member closes a Conversation route
- **THEN** that Conversation ViewModel is cleared
- **AND** the same Inbox route and filter become visible and refresh its thread
  pages

#### Scenario: Member reselects Messages

- **WHEN** a member reselects the active Messages tab
- **THEN** nested navigation returns to Inbox, clears its filter and reloads
  inbox pages
- **AND** no duplicate top-level tab visit is added

#### Scenario: Member sends a message

- **WHEN** a member sends a non-empty message or quick reply
- **THEN** the existing API request and quick-reply payload are preserved
- **AND** a successful response appears in the Conversation and clears its
  account-scoped draft
- **AND** a transport failure keeps the draft available for retry

#### Scenario: Draft survives a route or process recreation

- **WHEN** a member edits a Conversation draft and its route is recreated or
  reopened
- **THEN** the draft is restored from the existing account/counterpart draft
  store
- **AND** a successful send clears the stored draft

#### Scenario: Conversation request becomes obsolete

- **WHEN** a request is cancelled, superseded, or belongs to a removed route
  or previous session
- **THEN** its late result does not replace the current route state
- **AND** removing the route cancels its outstanding work

#### Scenario: Member session expires during messaging

- **WHEN** an Inbox or Conversation request reports an authentication failure
- **THEN** the route ViewModel emits one identified invalidation event
- **AND** the existing parent callback is delivered once and the event is
  acknowledged
- **AND** a renewed live session can retry without reusing old request results

#### Scenario: Activity is recreated in a message route

- **WHEN** Android recreates the activity while Inbox or Conversation is
  active
- **THEN** the safe Navigation 3 route and entry-scoped state are restored
  after the live session is available
- **AND** no cookie or session object is restored from route or saved state

#### Scenario: Alert opens a conversation without an Inbox row

- **WHEN** an authenticated message alert opens a Conversation route whose
  recipient is not present in the Inbox result
- **THEN** the Conversation ViewModel resolves that recipient through the
  existing authenticated mini-user endpoint using the route's stable member ID
- **AND** it loads messages without depending on Inbox ViewModel state
- **AND** Back returns through the preserved Inbox and prior shell origin

#### Scenario: Profile route is restored

- **WHEN** a member profile is opened from an Inbox or Conversation route and
  Android restores that route
- **THEN** its route key retains the public username required by the profile
  loader
- **AND** Back returns to the same source route and visit

#### Scenario: Profile conversation returns to its exact profile visit

- **WHEN** a member opens a conversation from a profile and Android recreates
  the Activity while that conversation is active
- **THEN** the conversation has its own entry-scoped state and restores using
  its stable member ID and visit identity
- **AND** Back restores the same profile entry, including its loaded data and
  saveable pager and list position
- **AND** repeated profile visits do not share conversation stores

#### Scenario: Unread message badge updates

- **WHEN** the authenticated shell performs its existing periodic inbox poll
- **THEN** the unread-message badge continues to reflect the current account
- **AND** route ViewModel state remains separate from shell badge polling

#### Scenario: Message route state excludes credentials

- **WHEN** Inbox, Conversation and profile message routes are serialised for
  navigation restoration
- **THEN** their route data contains only the destination identity and visit
  identity required to restore each route
- **AND** no session cookie, message content or draft is included in route data
- **AND** drafts remain in the existing account/counterpart draft store

### Requirement: Navigation-owned native profile forms

The Android app SHALL represent profile editing and Experience creation as
distinct Navigation 3 child entries owned by the active profile visit. The
direct Menu Edit destination SHALL be an actual Menu entry. Each form entry
SHALL own its immutable business state, API work and failure state through a
ViewModel created from that entry's real Navigation 3 store. Route keys SHALL
contain only stable public identifiers and visit IDs; they SHALL NOT contain
session credentials, cookies, translated labels, full profiles, server
responses or editable form contents.

#### Scenario: Member edits a profile

- **WHEN** a member opens Edit from their profile or the Menu
- **THEN** the editor is a distinct entry beneath that origin
- **AND** the canonical profile and current form are owned by the editor's
  entry-scoped ViewModel
- **AND** Back returns to the exact profile or Menu origin

#### Scenario: Member creates an Experience

- **WHEN** a member opens Experience creation from a profile
- **THEN** the recipient profile remains on the Navigation 3 stack
- **AND** the Experience form and request state belong to a distinct entry
- **AND** success returns to the same profile and refreshes its references

#### Scenario: Activity recreates while a form is open

- **WHEN** Android recreates the Activity while Edit Profile or Experience is
  open
- **THEN** the active route and in-memory form ViewModel state remain available
- **AND** no startup screen replaces the form
- **AND** no cookie, session credential or form draft is added to route keys or
  persistent storage

Profile form handoff state SHALL be held by a ViewModel scoped to the actual
enclosing decorated Navigation 3 entry owner, keyed by the parent profile
visit ID. It SHALL retain the loaded profile snapshot and display name only
while that route owner remains active, seed ordinary edit navigation without
an additional profile request, and clear the values when the profile route is
removed or the backend, account username or session cookie changes. Successful
profile save and Experience creation SHALL return typed one-shot completions
to the exact parent profile visit; repeated visits to the same username SHALL
not share or consume one another's completion. These runtime values SHALL NOT
be placed in route keys or saved state. After process death, Edit Profile SHALL
safely reload the canonical profile by username when no fast handoff snapshot
exists.

#### Scenario: Process restores a form route without its ViewModel

- **WHEN** Android restores a form route after process death and its ViewModel
  no longer exists
- **THEN** Edit Profile reloads the canonical profile and presents a clean
  baseline
- **AND** Experience creation starts with its existing default values
- **AND** the app does not restore an unsaved draft or repeat a save request

### Requirement: Profile form navigation protects unsaved changes

The active Edit Profile or Experience form SHALL use the shared leave guard for
toolbar Cancel, system/predictive Back and primary navigation. Keeping the form
after a discard prompt SHALL retain its exact values. Confirming discard SHALL
perform the pending navigation once. Saving SHALL block navigation and
duplicate submission until it completes. Save failures SHALL keep the form
open and expose localized errors resolved from typed failure metadata.

#### Scenario: Member attempts to leave a dirty profile form

- **WHEN** the member cancels, presses Back or changes top-level navigation
  after editing fields
- **THEN** one discard decision is shown before the route changes
- **AND** keeping the form retains every entered value
- **AND** confirming discard performs the requested route transition once

#### Scenario: Member saves while navigation is requested

- **WHEN** an Edit Profile or Experience save is in flight
- **THEN** the form cannot be left and another save cannot be submitted
- **AND** success updates the parent state and pops once
- **AND** a non-authentication failure leaves the form available for retry

#### Scenario: Form API reports an expired session

- **WHEN** an Edit Profile or Experience request reports an authentication
  failure
- **THEN** its ViewModel emits one identified invalidation event
- **AND** the shell handles that event once and clears account-owned entry
  stores
- **AND** a stale response after entry removal cannot invalidate a newer
  session

#### Scenario: Same-account session renewal preserves a form draft

- **WHEN** the active form receives a rotated session cookie for the same
  account and normalized backend
- **THEN** it updates its repository to use the current runtime API/session
- **AND** it retains the in-memory draft, cancels work started with the old
  cookie, and permits a new explicit retry after the authentication latch is
  renewed
- **AND** replacing the API client for the same backend does not reload Edit
  Profile or automatically repeat an Experience submission

#### Scenario: Account or backend changes while a form is retained

- **WHEN** a form entry receives a different account or normalized backend
- **THEN** its in-flight work is cancelled and stale responses are ignored
- **AND** the old form contents and authentication latch are cleared
- **AND** Edit Profile reloads only when the current account matches the route
  username; otherwise it remains empty until that entry is removed
- **AND** an Experience creation is never automatically resubmitted

#### Scenario: A member returns from Experience creation

- **WHEN** a member successfully creates an Experience and returns to the
  profile
- **THEN** the same profile entry and selected section are restored
- **AND** the profile's references reflect the newly created Experience

### Requirement: Navigation-owned Android sign-in destinations

The Android signed-out flow SHALL represent its form and browser destinations
as Navigation 3 entries. The root `SignInVisit` SHALL own its sign-in
ViewModel through the entry's ViewModel store. Sign-up and forgotten-password
pages SHALL be children identified by a safe purpose enum and a unique visit
identity. Their browser title and URL SHALL be derived from the purpose and
localised Android resources. Route keys and restored navigation state SHALL
NOT contain credentials, cookies, API responses or session objects.

#### Scenario: Member opens sign-up or password reset

- **WHEN** a signed-out member selects Join or Forgot password
- **THEN** the corresponding browser route is pushed above the same SignIn
  entry
- **AND** Back first traverses available WebView history, then returns to the
  existing form entry
- **AND** the browser route records no cookie or credential

#### Scenario: Activity recreates during sign-in

- **WHEN** Android recreates the Activity while the sign-in request is active
- **THEN** the same SignIn entry retains its in-memory form state and request
- **AND** the authentication request is not submitted again automatically
- **AND** no password, session or cookie is encoded in the navigation state

#### Scenario: Sign-in entry is removed or backend changes

- **WHEN** the sign-in destination is cleared after successful authentication
  or the configured backend changes
- **THEN** its ViewModel cancels outstanding work and clears credential fields
- **AND** any late authentication result is ignored
- **AND** a later signed-out visit starts with a fresh form

#### Scenario: Sign-in copy follows the Android locale

- **WHEN** a signed-out screen or its browser route is rendered under an
  Android locale configuration
- **THEN** its brand description, action labels, build label and browser titles
  come from the matching Android string resources
- **AND** the authentication URLs and API contract remain unchanged

### Requirement: Navigation-scoped Android discovery state

The Android HostMap and MemberSearch screens SHALL expose immutable UI state
from separate screen ViewModels and SHALL send user and viewport actions as
explicit events. Each ViewModel SHALL be obtained from the actual decorated
Search `MemberTabVisit(Destination.Search, visitID)` Navigation 3 entry's
ViewModel store through an injectable repository boundary. The nested Search
stack SHALL retain this visit beneath Map/Members mode content and
HostDetail/MemberProfile routes. The map state SHALL retain its filters, visible offers, place search
state, camera coordinates/zoom and safe community-note values. Host offer,
profile and membership detail data SHALL belong to their child route owners,
not the map ViewModel or saved route key. The member-search state SHALL retain
its query, submitted results and search status. These states SHALL remain
available while the Search visit is retained off-screen and across Activity
recreation. Neither ViewModel nor its saveable navigation state SHALL persist
a session, cookie, API client or credential. Removing the authenticated Search
root SHALL cancel its work and clear its account-owned state.

#### Scenario: Member changes Search mode

- **WHEN** a member switches from HostMap to MemberSearch or back within one
  Search visit
- **THEN** the visible screen uses its existing ViewModel state
- **AND** the other mode retains its query or filters, results, camera and
  active request state

#### Scenario: Search mode Back follows the visit's initial mode

- **WHEN** a Search visit begins on Map and the member switches to Members
- **THEN** Back returns to that visit's Map mode
- **WHEN** a Search visit begins on Members
- **THEN** Back at its Members root delegates to the existing shell history
  without inserting a synthetic route owner

#### Scenario: Member temporarily leaves Search

- **WHEN** a member navigates to another top-level tab while the Search visit
  remains on the Navigation 3 back stack
- **THEN** returning to Search restores its HostMap and MemberSearch state
- **AND** successful data is not reloaded solely because Search was temporarily
  off-screen

#### Scenario: Activity recreates during discovery

- **WHEN** Android recreates the Activity while a member uses Search
- **THEN** the Search entry's ViewModels retain the member query/results,
  map filters and camera position/zoom
- **AND** any still-current request remains observed or safely restarts without
  displaying an obsolete result
- **AND** no cookie or session credential appears in restored state or route
  keys

#### Scenario: Member opens a host detail from the map

- **WHEN** a member opens a host offer and its profile from a visible map
  marker
- **THEN** Navigation 3 pushes HostDetail and MemberProfile under the same
  Search visit with only the stable offer/member identifiers in route keys
- **AND** Back returns to the map with the same camera, filters and visible
  offers
- **AND** fetched host, profile and membership records are owned by their
  detail entries rather than copied into the map ViewModel or route keys

#### Scenario: Host detail overlays and retains the same map visit

- **WHEN** a member opens HostDetail from a map marker
- **THEN** HostDetail appears as a bottom-aligned surface above a dim scrim
  while the same map scene remains composed beneath it
- **AND** the scrim blocks map input, while the shell and its bottom
  navigation remain in the same Activity window
- **AND** Back, including a cancelled predictive Back gesture, leaves the
  retained map visit and its camera, filters, results and community-note
  source unchanged

#### Scenario: Map resumes with an unchanged viewport

- **WHEN** Activity recreation or return from Members/detail restores the same
  measured bounds and map filters after a successful visible-area response
- **THEN** the map reuses the retained offers without an identical duplicate
  API request
- **AND** a changed viewport/filter or explicit reset starts a fresh debounced
  request

#### Scenario: Member explicitly reselects Search

- **WHEN** a member reselects the active Search tab
- **THEN** Navigation 3 returns to the Search map root without adding a shell
  history visit
- **AND** the member query, results, searched/error state and in-flight request
  are cleared
- **AND** the map returns to its existing default camera and filters, clears
  place text, suggestions and old results, and performs a fresh visible-area
  search

#### Scenario: Obsolete member or map request completes

- **WHEN** a newer query, filter, viewport, place lookup, explicit reset or
  entry removal supersedes an earlier request
- **THEN** the earlier response does not replace current results, loading or
  error state, move the map, or restore obsolete suggestions

#### Scenario: Place suggestions or location lookup fails

- **WHEN** a place query is too short, returns no match or fails
- **THEN** the map retains its existing viewport and visible offers
- **AND** a late response for a previous query does not change the camera or
  show an obsolete error

#### Scenario: Member searches a text place

- **WHEN** a member types at least three trimmed characters in place search
- **THEN** suggestions are requested after the existing 400 ms delay and show
  no more than three value-type results
- **AND** selecting a suggestion or submitting a place zooms to level 9 and
  searches that viewport after measurement
- **AND** the flow uses Android Geocoder without requesting device-location
  permission or saving `Context`, `Address` or `Geocoder` objects in ViewModel
  state

#### Scenario: Member disables both map offer types

- **WHEN** both Hosts and Meet are disabled
- **THEN** the current map-search request is cancelled, visible offers are
  cleared and loading stops without sending an empty-types API request

#### Scenario: Discovery request reports an expired session

- **WHEN** a member search, map search, host-context or circle-membership
  request reports an authentication failure
- **THEN** the ViewModel emits one identified session-invalidation event
- **AND** the existing shell callback is delivered once and acknowledges the
  event
- **AND** the removed Search entry cancels outstanding work and closes its live
  community-note source

#### Scenario: A different account opens Search

- **WHEN** a member signs out or their session expires and another account
  opens Search
- **THEN** the prior Search entry and ViewModels are cleared
- **AND** the new account starts with default map state and an empty member
  search

#### Scenario: Member returns from a child discovery destination

- **WHEN** a member opens a host or member profile from Search and returns with
  Back
- **THEN** the same Search visit restores the map camera, active filters,
  results, member query and result list position that preceded the child
  destination

#### Scenario: Search map and community-note source become inactive

- **WHEN** a member switches from Map to Members while Meet remains enabled
- **THEN** the map-only live note source closes while Search stays on Members,
  and existing safe notes remain with that Search entry
- **AND** returning to Map opens one current source and continues filtering
  received notes
- **AND** opening HostDetail or a member profile as an overlay above the map
  keeps the map scene and its live note source connected
- **AND** disabling Meet closes the source and clears received and visible
  notes, as before
- **AND** removing the Search-root entry closes the source and clears its
  ViewModel state

### Requirement: Authenticated shell state belongs to a root Navigation 3 visit

The authenticated Android shell SHALL be rendered by a decorated root
Navigation 3 entry scoped to the signed-in public username. The root entry
SHALL own the shell's avatar identifier and unread-message badge state, while
each top-level tab visit SHALL retain its existing distinct Navigation 3
entry and child-state lifetime. The root route and saved shell state SHALL NOT
contain session credentials, cookies, API clients, message content or profile
payloads.

#### Scenario: Member shell restores after Activity recreation

- **WHEN** Android recreates the Activity while an authenticated member is in
  a top-level tab visit
- **THEN** the root shell and nested tab visit restore under the live session
- **AND** completed avatar and unread lookups are not repeated solely because
  the API client object was recreated for the same backend and account
- **AND** no cookie or session credential is present in route keys or saved
  shell state

#### Scenario: Shell unread badge refreshes independently of Messages

- **WHEN** a member changes the active top-level tab or the shell's 60-second
  unread interval elapses while the Activity is started
- **THEN** the root shell refreshes the unread count using the existing inbox
  endpoint even if Messages is not composed
- **AND** the unread badge continues to show the count of unread threads

#### Scenario: Shell polling follows Activity lifecycle

- **WHEN** the Activity stops while the authenticated shell is active
- **THEN** the root shell cancels its unread timer and in-flight unread request
- **WHEN** the Activity starts again
- **THEN** the shell performs one immediate unread refresh and resumes the
  existing 60-second cadence

#### Scenario: Authentication expires during a shell lookup

- **WHEN** the avatar or unread request reports an expired session
- **THEN** the shell delivers the existing session-invalidation callback once
- **AND** removing the authenticated root clears its shell state and nested
  visit stores

#### Scenario: Account changes while shell requests are outstanding

- **WHEN** the current authenticated account is replaced or its API backend
  changes before a shell request completes
- **THEN** the old request is cancelled or ignored
- **AND** the new root visit displays no result from the former account
