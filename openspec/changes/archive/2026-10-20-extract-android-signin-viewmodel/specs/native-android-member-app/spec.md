## ADDED Requirements

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
