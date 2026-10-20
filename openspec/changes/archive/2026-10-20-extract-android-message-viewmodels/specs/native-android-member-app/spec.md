## ADDED Requirements

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
