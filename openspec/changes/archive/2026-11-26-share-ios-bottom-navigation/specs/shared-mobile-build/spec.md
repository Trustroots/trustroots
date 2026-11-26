## ADDED Requirements

### Requirement: Regular iOS bottom navigation uses shared Compose

The signed-in iOS shell SHALL use shared Compose for the Home, Search,
Messages, and Menu actions and make the selected destination available
to accessibility services. The iOS shell SHALL own destination routing,
bottom safe-area handling, and navigation visibility while typing.

#### Scenario: Select Search from Home

- **GIVEN** a signed-in member is on Home
- **WHEN** they choose Search in the bottom navigation
- **THEN** the native Search destination opens and Search is marked selected
- **AND** the bottom navigation hides while the member types and returns when the keyboard closes
