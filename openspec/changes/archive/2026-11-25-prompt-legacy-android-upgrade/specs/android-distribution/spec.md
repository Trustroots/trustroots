## ADDED Requirements

### Requirement: Legacy Android upgrade notice

The website SHALL present a dismissible migration notice when the unsupported Expo Android app identifies itself through its WebView bridge.

#### Scenario: A member opens the old Android app

- **WHEN** the Expo WebView identifies its platform as Android
- **THEN** the website explains how to install the signed Android preview and sign in with the existing account before removing the old app
- **AND** the download action opens the current signed APK download page in the device browser

#### Scenario: A member dismisses the notice

- **WHEN** the member dismisses the migration notice
- **THEN** it stays dismissed in that WebView across visits when local storage is available

#### Scenario: A member uses another client

- **WHEN** the legacy Android bridge is absent or identifies another platform
- **THEN** the website does not show the migration notice
