## ADDED Requirements

### Requirement: Android preview download link

The system SHALL offer a compact link below the shared site navigation to
download the signed Trustroots Android preview.

#### Scenario: Android visitor views the shared header

- **WHEN** a signed-in or signed-out visitor opens a page with the shared header in an Android browser
- **THEN** the header shows a text link under the navigation
- **AND** following the link opens the existing latest APK page in the same tab

#### Scenario: Another platform views the shared header

- **WHEN** a visitor opens a page with the shared header from a non-Android browser
- **THEN** the header omits the Android preview download link
