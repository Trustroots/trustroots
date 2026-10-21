## MODIFIED Requirements

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
