## MODIFIED Requirements

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
- **AND** signed-out Startup retains its minimum of 700 ms measured from the start of restoration
- **AND** a restored signed-in member sees the personalised greeting for at least two seconds after their session is loaded
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

## ADDED Requirements

### Requirement: Android fresh sign-in destination

The Android app SHALL open Messages after a successful fresh sign-in. It SHALL preserve restored navigation and explicit message destinations, and SHALL retain sign-up onboarding.

#### Scenario: Member signs in

- **WHEN** a member successfully signs in
- **THEN** Messages opens without an additional navigation action

#### Scenario: Member already has a destination

- **WHEN** an authenticated navigation stack is restored or a message alert supplies a conversation destination
- **THEN** that destination takes precedence over the initial destination

#### Scenario: Member signs up

- **WHEN** a member creates an account
- **THEN** the existing sign-up onboarding remains available
