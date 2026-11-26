## ADDED Requirements

### Requirement: Regular iOS profile editing uses the shared form

The regular iOS profile editor SHALL use shared Compose for the name, tagline,
locations, language selector, biography and save action. It SHALL use the
existing authenticated iOS profile update, require a nonblank name and preserve
the existing trimming and biography loading rules. Language selection SHALL
use the existing iOS picker.

#### Scenario: Edit and save profile text from Compose

- **GIVEN** a signed-in member opens the profile editor
- **WHEN** they update their tagline or biography and save
- **THEN** the app submits the new text with the other loaded preferences through the existing iOS profile update
- **AND** the app returns to the profile after a successful save
