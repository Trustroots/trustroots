## ADDED Requirements

### Requirement: Regular iOS profile uses shared activity and location sections

The regular iOS profile SHALL display last login, reply rate and any available
reply time in Compose. It SHALL show actions for the member's current location
and place of origin when available, using the existing iOS search map route.

#### Scenario: Read activity and open a location

- **GIVEN** a member opens a profile with reply statistics and a current location
- **WHEN** they read the activity section and select the location
- **THEN** they can see the reply statistics and the app opens the Search map for that location
