# native-android-member-app Specification

## Purpose

TBD - created by archiving change notify-android-preview-updates. Update Purpose after archive.

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
and unread-message indicator. Rotation SHALL preserve the active screen, nested
navigation, search/map state and unsaved form values without replaying startup.

#### Scenario: Member rotates while editing

- **WHEN** a member rotates the device while editing a profile
- **THEN** the editor and entered values remain visible without a startup screen

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

The Android member search, profile detail, profile editing, inbox, conversation
and contacts screens SHALL each have a named package below `ui` with a separate
screen entry-point file. Components and helpers shared across those screens
SHALL live in `ui/common`. Source organisation changes SHALL preserve existing
screen state, navigation callbacks, API behaviour and UI interactions.

#### Scenario: Maintaining one member screen

- **WHEN** a contributor changes one of these Android member screens
- **THEN** its entry point is in that screen's package
- **AND** shared components are available through `ui/common`

#### Scenario: Existing member journeys after source extraction

- **WHEN** a member searches, opens a profile, edits their profile, reads an
  inbox, opens a conversation or browses contacts after source extraction
- **THEN** the existing interactions and Back callbacks remain unchanged
- **AND** existing Android journey coverage remains in place

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
visits to the same destination. After the parent has loaded the live
authenticated session, the active destination SHALL be restorable after
activity recreation. Top-level tab keys SHALL be serialisable and contain no
session credentials, cookies, account secrets or member-specific payloads. The
live authenticated parent SHALL remain the source of session and member data.

#### Scenario: Member switches between top-level destinations

- **WHEN** a member selects a different top-level destination
- **THEN** Navigation 3 records a new uniquely identified visit after the
  current one
- **AND** Back returns to the previous destination in the member's navigation
  history

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

Top-level Navigation 3 Back handling SHALL preserve existing menu-page,
embedded-browser and nested-screen Back behaviour. A dirty editable form SHALL
be offered the existing keep-editing or discard decision before a top-level
navigation action or Back pop commits. Cancelling predictive Back SHALL NOT
commit a pop or bypass the leave decision.

#### Scenario: Member backs out of a nested menu page

- **WHEN** a member presses Back while a menu subpage or embedded browser is
  open
- **THEN** the nested page or browser closes before the top-level history is
  popped

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
tabs. Profile actions SHALL remain above it; the artwork image and scrim SHALL
extend behind legible tabs. The header and tabs SHALL remain outside the
`HorizontalPager`, which contains only scrollable section content. Tab selection
and pager swipes SHALL stay synchronised. On compact screens, the header SHALL
use a horizontal avatar and text layout and preserve usable section space after
bottom insets.

#### Scenario: Member scrolls a profile section

- **WHEN** a member scrolls the About, Contacts or Experiences content
- **THEN** the profile actions, artwork header and section tabs remain visible
- **AND** only the current section content scrolls

#### Scenario: Member swipes between profile sections

- **WHEN** a member swipes the section pager
- **THEN** the newly selected section is shown
- **AND** its tab is selected while the shared header and tab row remain in one
  place

#### Scenario: Member sees section tabs over the profile artwork

- **WHEN** a member views a loaded profile
- **THEN** the section tabs are inside the artwork header
- **AND** the profile background image and scrim continue behind the tabs
- **AND** the tabs remain legible against the scrim

#### Scenario: Member opens a profile in a compact viewport

- **WHEN** the profile viewport is 360 dp tall with a 24 dp top inset and an
  80 dp bottom inset
- **THEN** the artwork header uses a compact horizontal presentation
- **AND** at least 96 dp remain available for section content after bottom
  padding
- **AND** the section remains vertically scrollable

#### Scenario: Member opens a profile in a shorter viewport

- **WHEN** the profile viewport is 320 dp tall with a 24 dp top inset and an
  80 dp bottom inset
- **THEN** the compact header keeps at least 48 dp available for section
  content after bottom padding
- **AND** the section remains vertically scrollable

#### Scenario: Profile is loading or fails to load

- **WHEN** the profile request is pending or fails
- **THEN** the loading or error state remains available without a partial
  interactive profile frame
