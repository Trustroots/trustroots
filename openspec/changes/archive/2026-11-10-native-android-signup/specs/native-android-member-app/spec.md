## MODIFIED Requirements

### Requirement: Navigation-owned Android sign-in destinations

The Android signed-out flow SHALL represent sign-in, native signup and
browser destinations as Navigation 3 entries with unique visit identities.
The sign-in and signup forms SHALL own their ViewModels through their entries.
Browser titles SHALL use localised Android resources. Route keys and restored
navigation state SHALL NOT contain credentials, cookies, API responses or
session objects.

#### Scenario: Member opens sign-up or password reset

- **WHEN** a signed-out member selects Join or Forgot password
- **THEN** the native signup form or password reset browser route is pushed above the same sign-in entry
- **AND** the signup form respects system and keyboard insets
- **AND** returning from the rules using either Android Back or the app bar preserves entered values
- **AND** Back from password reset first traverses available WebView history, then returns to the existing sign-in form
- **AND** the browser routes record no cookie or credential

#### Scenario: Complete onboarding

- **WHEN** signup through the existing account endpoint and mobile sign-in succeed
- **THEN** the app SHALL explain that email confirmation is required and offer the native profile editor and an action to continue into the main app
- **AND** saving or leaving the profile editor SHALL provide a route into the main app

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
