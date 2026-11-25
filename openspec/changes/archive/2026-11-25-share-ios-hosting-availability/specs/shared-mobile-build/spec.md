## ADDED Requirements

### Requirement: Regular iOS hosting availability uses Compose

The regular iOS hosting editor SHALL use shared Compose for hosting and
meeting availability, maximum guests when hosting is possible, and visibility
within the member's circles. It SHALL use the existing form validation,
location capture and offer save flow.

#### Scenario: Save availability from the iOS hosting editor

- **GIVEN** a signed-in member opens an existing hosting offer
- **WHEN** they change meeting availability or circle visibility and save
- **THEN** the editor submits those changes on the existing offer with its saved coordinates
- **AND** maximum guests remains between zero and 99 and is editable when hosting is available or tentative
