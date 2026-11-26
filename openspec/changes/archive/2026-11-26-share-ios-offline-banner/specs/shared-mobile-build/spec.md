## ADDED Requirements

### Requirement: iOS saved-data notices use shared Compose

The regular iOS app and shared member pilot SHALL render their saved-data
notice with shared Compose. The notice SHALL expose the complete text to
accessibility services. The iOS host SHALL continue to supply the locale-formatted
saved timestamp and to clear the notice when live data becomes available.

#### Scenario: Read a saved profile in the regular iOS app

- **GIVEN** a signed-in member previously loaded their profile
- **WHEN** they open the profile while its server connection is unavailable
- **THEN** the app displays the saved profile and announces its saved timestamp
- **AND** a successful live inbox request clears the notice
