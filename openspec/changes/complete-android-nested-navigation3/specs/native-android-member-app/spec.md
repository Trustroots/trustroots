## ADDED Requirements

### Requirement: Navigation 3 owns nested Android member navigation

Each authenticated top-level tab visit SHALL own a distinct Navigation 3 child
stack for its nested destinations. Nested routes SHALL retain their originating
screen so Back returns to the screen that opened them, including when the same
destination can be opened from multiple flows. Route keys SHALL be serialisable
and contain only route identity and the minimum stable public resource
identifier needed to reload the destination. Session credentials, member
session objects, API responses and private message content SHALL remain outside
navigation keys and saved navigation state. The live authenticated parent and
entry-scoped screen state owners SHALL supply session data and destination
content.

#### Scenario: Member opens a circle detail

- **WHEN** a member opens a circle from the Circles overview
- **THEN** Navigation 3 places the circle detail above that overview entry
- **AND** toolbar or system Back returns to the same overview with its filter
  and scroll state retained

#### Scenario: Member opens a profile from different flows

- **WHEN** a member opens a profile from Search, a map result, a conversation,
  Contacts or another profile
- **THEN** the profile is placed above the route that initiated the action
- **AND** Back returns to that exact initiating route with its state retained

#### Scenario: Member follows a message conversation

- **WHEN** a member opens a conversation from the inbox and then opens the
  other member's profile
- **THEN** the route history is Inbox → Conversation → MemberProfile
- **AND** successive Back actions return to the conversation and then the
  same inbox state

#### Scenario: Member opens a conversation from an alert

- **WHEN** a valid alert requests a conversation for the signed-in member
- **THEN** the shell selects or pushes a Messages tab visit and opens the
  requested conversation above its Inbox route
- **AND** Back returns to Inbox before following the prior top-level origin

#### Scenario: Member backs out of an embedded browser

- **WHEN** a member presses Back while a browser route has WebView history
- **THEN** Back first moves through the WebView history
- **AND** the next Back closes the browser route and returns to its originating
  screen
- **AND** runtime authentication cookies are not restored from route state

#### Scenario: Member uses toolbar, system or predictive Back

- **WHEN** a member uses toolbar Back, system Back or completes a predictive
  Back gesture
- **THEN** transient presentation state is dismissed before the active child
  route is popped
- **AND** a child route is popped before a top-level tab visit
- **AND** cancelling predictive Back leaves every stack unchanged

#### Scenario: Member leaves a dirty nested form

- **WHEN** a member attempts a route push, pop, browser close or tab change
  that would leave a dirty form
- **THEN** the existing keep-editing or discard decision runs before the
  navigation stack changes
- **AND** keeping edits leaves the current route and all stack entries intact

#### Scenario: Member reselects the active top-level tab

- **WHEN** a member selects the already active bottom navigation destination
- **THEN** that destination's established reset action returns its child flow
  to its root state
- **AND** Navigation 3 does not add a duplicate top-level visit

#### Scenario: Android recreates an activity in a nested route

- **WHEN** Android recreates the activity while a member is on a nested route
- **THEN** the safe top-level and child route history is restored after the
  live authenticated session is validated
- **AND** destination data is reloaded from the authenticated API
- **AND** route state contains no credentials, private message text or API
  response payloads
- **AND** if the session is missing or invalid, the authenticated route stacks
  are discarded and sign-in is shown
