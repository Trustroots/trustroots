## ADDED Requirements

### Requirement: Shared native iOS Circles discovery

The regular iOS app SHALL render Circles discovery with the shared Compose UI,
using its signed-in server catalog and membership state. Members SHALL be able
to filter by circle name or description, open circle details, manage their
membership, and open the Trustroots Wiki. Joined circles SHALL appear first.

#### Scenario: Discover a circle and open its details

- **GIVEN** a signed-in iOS member opens Circles
- **WHEN** the member filters the available circles and opens a matching result
- **THEN** the app shows the circle's native details
- **AND** returning to discovery restores the current filter

#### Scenario: Change circle membership from discovery

- **WHEN** a signed-in iOS member changes a circle membership from discovery
- **THEN** the app updates the membership through the signed-in API
- **AND** the list reflects the returned membership state
