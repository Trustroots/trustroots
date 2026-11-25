## ADDED Requirements

### Requirement: Regular iOS hosting details use Compose

The regular iOS hosting editor SHALL use shared Compose for the hosting
description, the explanation shown when unavailable and the volunteering
setting. It SHALL save with the existing offer validation and location data.
Existing rich text SHALL be retained for descriptions that the member leaves
unchanged.

#### Scenario: Edit a multiline host offer description

- **GIVEN** a signed-in member opens an existing offer with saved descriptions and coordinates
- **WHEN** they edit the reason they are unavailable across multiple lines and save
- **THEN** the existing offer contains the edited text and its original coordinates
- **AND** the unchanged hosting description retains its saved rich text
