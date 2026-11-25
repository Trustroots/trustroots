## MODIFIED Requirements

### Requirement: Native destinations remain the application defaults

The shared build and debug previews SHALL preserve the existing default
signed-in destinations on Android and iOS.

#### Scenario: Existing Android destinations continue to launch

- **WHEN** the Android app is launched normally
- **THEN** the existing Android navigation and destinations remain in use

#### Scenario: Existing iOS destinations continue to launch

- **WHEN** a signed-in member launches the iOS app normally
- **THEN** the existing SwiftUI member root and destinations remain in use

### Requirement: Shared pilot starts at a member dashboard

The signed-in shared Compose pilot SHALL start at a dashboard on Android and
iOS. It SHALL offer the shared profile and inbox journeys. Dashboard actions
SHALL remain usable without profile, circle or local-event responses. The
pilot SHALL remain opt-in.

#### Scenario: A saved member opens the shared pilot

- **WHEN** a signed-in member opens the shared pilot
- **THEN** Home offers My profile and Messages
- **AND** opening profile or messages and going Back returns to Home
- **AND** Exit shared pilot exits using the existing host callback

#### Scenario: A member signs in from the shared pilot

- **WHEN** sign-in succeeds and the host supplies the authenticated username
- **THEN** the shared pilot displays Home using the existing secure session
- **AND** Home renders even if discovery requests fail

## ADDED Requirements

### Requirement: Regular iOS sign-in uses the shared Compose form

The regular iOS app SHALL display the shared Compose sign-in form when signed
out. The form SHALL use native iOS password input traits and the existing
secure iOS session store. The iOS host SHALL retain Join through its bounded
browser, sign-in errors, server and build diagnostics, and the debug simulator
server picker.

#### Scenario: Sign in from a regular iOS launch

- **GIVEN** a signed-out member launches the iOS app normally
- **WHEN** they submit valid credentials from the shared sign-in form
- **THEN** the app displays the regular SwiftUI member destinations
- **AND** a new launch uses the saved iOS session

#### Scenario: Open Join while signed out

- **WHEN** a signed-out member chooses Join from the shared form
- **THEN** the iOS bounded browser opens Join and can return to sign-in
