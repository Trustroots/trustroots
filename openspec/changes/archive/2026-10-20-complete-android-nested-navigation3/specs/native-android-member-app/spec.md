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
- **AND** the detail route key contains only its public circle slug and visit
  identity
- **AND** a detail-owned ViewModel reloads the canonical circle and membership
  state through the existing API
- **AND** toolbar or system Back returns to the same overview with its filter
  and scroll state retained without reloading the circle catalogue

#### Scenario: Member restores a circle detail

- **WHEN** Android recreates the activity while a circle detail is open
- **THEN** the detail route reloads its circle by slug and reloads membership
  state from the authenticated API
- **AND** circle payloads, membership responses and session credentials are
  absent from the route key and saved navigation state

#### Scenario: The Circles entry receives an updated runtime environment

- **WHEN** the retained overview or detail entry receives a new API client for
  the same normalized backend
- **THEN** its repository uses the new client without reloading data or
  repeating a membership mutation
- **WHEN** its backend, account or session cookie changes
- **THEN** active work from the previous environment is cancelled and stale
  results are ignored
- **AND** account-scoped state is cleared and loaded again through the current
  runtime environment without changing the Navigation 3 entry owner

#### Scenario: Member changes circle membership from detail

- **WHEN** a member joins or leaves a circle from its detail screen
- **THEN** the detail ViewModel handles the request, loading state, failures
  and retry against the existing membership endpoint
- **AND** success updates the retained overview membership set without
  reloading its catalogue or clearing its filter and scroll position

#### Scenario: Member opens unavailable circle detail

- **WHEN** a restored circle slug cannot be loaded
- **THEN** the detail route displays its retryable load failure
- **AND** it does not require a circle object serialized in the route key

#### Scenario: Member reselects Circles while detail is open

- **WHEN** a member reselects the active Circles tab while detail is visible
- **THEN** the nested stack resets to a fresh overview route
- **AND** the removed detail and overview entry owners release their state

Circle detail does not currently expose member rows or profile actions. The
available `/api/tribes/:tribe/members` endpoint is outside this route slice;
do not invent a member-list or profile flow as part of this migration.

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

#### Scenario: Member opens a conversation from a profile

- **WHEN** a member opens a conversation from a member profile
- **THEN** Navigation 3 pushes a distinct `ProfileConversationVisit` above
  that exact profile entry
- **AND** the route uses the decorated entry's independent
  `MessageConversationEntryScreen` ViewModel, without depending on an Inbox
  entry or inbox-loaded data
- **AND** route identity contains only the stable public member ID and unique
  visit ID, while the current authenticated session is provided at runtime
- **AND** Back and Activity recreation restore the same loaded profile,
  selected tab, pager/list position and scroll state beneath the conversation

#### Scenario: Member opens a contact request from a profile

- **WHEN** a member starts a contact request from a profile with a stable
  member ID
- **THEN** Navigation 3 pushes a decorated profile browser entry identified
  by contact-request destination, member ID and unique visit ID
- **AND** the localized title and contact-add URL are derived at runtime and
  the current session cookie is supplied only to the WebView
- **AND** route and saved state contain no username, cookie, resolved title or
  URL, or private request payload
- **AND** Back first traverses WebView history when available, then closes
  the browser and restores that exact profile entry

#### Scenario: Member follows actions from a profile

- **WHEN** a member opens a related profile, conversation, edit form,
  experience form or embedded browser from a profile
- **THEN** that destination has its own decorated Navigation 3 entry above the
  profile visit
- **AND** successive Back actions return to the exact profile and then its
  original Contacts, Search, map, Messages or menu route
- **AND** route keys contain only the public username or member ID required to
  reload the destination

#### Scenario: Member opens a profile from Contacts, Search or a map result

- **WHEN** a member opens a profile from Contacts, member Search or a map host
  result
- **THEN** the source route remains below the profile on its own flow stack
- **AND** Back restores its previous loaded state, filters, scroll and selection

#### Scenario: Member opens a profile from Contacts in the Menu flow

- **WHEN** a member opens a contact profile from the Contacts page
- **THEN** Contacts remains an actual Menu child entry below a distinct
  username-keyed profile entry
- **AND** Back or Activity recreation restores the same loaded Contacts list
- **AND** reselecting Menu returns to the Menu root and clears the Contacts
  and profile entries
- **AND** profile usage analytics is active only while the profile entry is
  current, then returns to Contacts usage after Back

#### Scenario: Member edits their profile from a profile route

- **WHEN** a member opens Edit Profile from their own profile, edits a field,
  and tries to leave
- **THEN** toolbar, system and predictive Back all use the edit entry's same
  discard guard
- **AND** cancelling discard leaves the profile and edit entries unchanged
- **AND** confirming discard pops only Edit Profile
- **AND** a saved update refreshes the retained profile from the API
- **AND** the existing loaded profile snapshot seeds the edit ViewModel without
  a duplicate profile request during ordinary navigation
- **AND** a typed `ProfileSaved` completion is delivered once to that exact
  parent profile visit

#### Scenario: Member restores an edit route after process recreation

- **WHEN** Android restores an Edit Profile entry after process death
- **THEN** it reloads the canonical own profile using the route username
- **AND** it normalises HTML description with the existing plain-text
  conversion before calculating dirty state
- **AND** no profile payload, form contents or session cookie is restored from
  the route key
- **AND** if the runtime handoff snapshot is unavailable after process death,
  the edit ViewModel reloads canonical profile data by username

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

### Requirement: Search mode and map detail routes preserve their real owner

The Search flow SHALL represent Map and Members as child Navigation 3 mode
routes beneath the authenticated shell's actual decorated Search tab visit.
Search and map ViewModels SHALL remain owned by that shell visit while mode,
profile or host-detail routes are current. A selected map offer SHALL use a
serialisable HostDetail route containing only its public offer ID, constrained
offer type and unique visit ID. The HostDetail route SHALL own a distinct
ViewModel which loads canonical detail data from the existing authenticated
API, handles retryable failures and one-shot session invalidation, and cancels
or ignores work after its entry is removed. HostDetail SHALL be displayed as a
Navigation 3 overlay above the same map entry. Route state SHALL not contain
offers, profiles, memberships, credentials or API response payloads.

#### Scenario: Member changes Search mode and uses root Back

- **WHEN** a Search visit opened in Map switches to Members and the member
  presses Back at the mode root
- **THEN** Navigation 3 returns to Map within that same Search visit
- **AND** the existing map ViewModel, camera, filters and completed-query
  fingerprint remain owned by the shell Search entry
- **AND** selecting a mode does not add a duplicate Search visit or create a
  child ViewModel store for SearchHub

#### Scenario: Search visit opened in Members delegates root Back

- **WHEN** a Search visit opened in Members switches to Map and the member
  presses Back at the mode root
- **THEN** root Back follows the existing shell behaviour for a visit whose
  initial mode was Members
- **AND** no hidden synthetic Search owner or duplicate mode history is
  created

#### Scenario: Member opens map HostDetail

- **WHEN** a member selects a host or meet marker on the map
- **THEN** a HostDetail entry is pushed above the current Map mode using an
  overlay scene, while the same decorated map entry remains visibly composed
  underneath
- **AND** the HostDetail ViewModel loads the canonical offer, profile and
  membership information from their existing API reads
- **AND** the map camera, filters, loaded results, notes and note-source
  lifecycle remain with the original Search visit
- **AND** returning from HostDetail restores the same map without a duplicate
  completed offer request or notes-source reconnection

#### Scenario: Member opens a profile from HostDetail

- **WHEN** a member opens the host's profile from HostDetail and presses Back
- **THEN** Back returns to that same HostDetail entry
- **AND** the next Back returns to the unchanged Map route and its originating
  Search visit

#### Scenario: HostDetail is recreated or removed

- **WHEN** Android recreates the activity while HostDetail is current
- **THEN** the HostDetail route restores from its safe offer ID, offer type
  and visit ID and reloads canonical detail data after session validation
- **AND** pending detail work is cancelled or stale completions are ignored
  when the HostDetail entry is popped or its Search visit is removed
- **AND** a session-invalidating response clears the authenticated Search
  visit and its route-owned ViewModels before another account is shown

#### Scenario: Member reselects Search while a child route is open

- **WHEN** the member reselects the active Search tab while a profile or
  HostDetail route is current
- **THEN** the existing visit-scoped reset clears child routes and returns to
  the Map root
- **AND** map defaults and empty member-search state are restored without
  adding a shell visit
