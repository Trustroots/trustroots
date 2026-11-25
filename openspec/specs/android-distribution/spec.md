# android-distribution Specification

## Purpose

Describe the distribution of signed Android previews and their publication to Zapstore from the apps page.

## Requirements

### Requirement: Browser publication of an existing Android preview

The apps page SHALL allow the established Trustroots publisher to publish a prepared, signed Android preview to the Zapstore beta channel through a NIP-07 browser signer.

#### Scenario: Maintainer reviews a prepared candidate

- **WHEN** the apps page has a verified release descriptor and APK
- **THEN** it shows the candidate version and APK digest before the maintainer starts publishing
- **AND** it does not request private keys or GitHub credentials

#### Scenario: A preview is published successfully

- **WHEN** the maintainer starts publication with the correct browser identity
- **THEN** the page verifies the APK digest, completes any required authorised upload and publishes matching asset and release events
- **AND** it reports success only after the relay acknowledges the events and returns the published release

#### Scenario: Publication cannot finish

- **WHEN** the identity, descriptor, digest, signature, upload or relay response is invalid or unavailable
- **THEN** the page reports the failed step and allows retry
- **AND** it does not report a successful publication

#### Scenario: Candidate is already available

- **WHEN** the candidate version is already published on the beta channel
- **THEN** the page reports that no update is needed without requesting event signatures

#### Scenario: A new Android APK is released

- **WHEN** the Android release and docs workflows prepare a new candidate
- **THEN** the descriptor reflects the APK's verified package, version, digest and signing certificate
- **AND** the browser action publishes that candidate without rebuilding the APK

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
