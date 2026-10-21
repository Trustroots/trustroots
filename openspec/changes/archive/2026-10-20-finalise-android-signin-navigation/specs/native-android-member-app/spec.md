## ADDED Requirements

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
