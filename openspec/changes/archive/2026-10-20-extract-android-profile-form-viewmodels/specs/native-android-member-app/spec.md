## ADDED Requirements

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
