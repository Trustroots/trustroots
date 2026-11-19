## ADDED Requirements

### Requirement: Shared pilot starts at a member dashboard

The signed-in shared Compose pilot SHALL start at a dashboard on Android and
iOS. It SHALL offer the shared profile and inbox journeys and explain Nostroots
with a link to its public introduction. Dashboard actions SHALL remain usable
without profile, circle or local-event responses. Existing native app defaults
SHALL remain unchanged during the pilot.

#### Scenario: A saved member opens the shared pilot

- **WHEN** a signed-in member opens the shared pilot
- **THEN** Home offers My profile, Messages and Learn about Nostroots
- **AND** opening profile or messages and going Back returns to Home
- **AND** Open native app exits using the existing host callback

#### Scenario: A member signs in from the shared pilot

- **WHEN** sign-in succeeds and the host supplies the authenticated username
- **THEN** the shared pilot displays Home using the existing secure session
- **AND** no profile, circle or local-event request is required to render Home
