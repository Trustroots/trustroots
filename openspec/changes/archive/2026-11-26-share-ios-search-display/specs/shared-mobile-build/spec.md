## ADDED Requirements

### Requirement: Regular iOS Search uses a shared display selector

The regular iOS Search screen SHALL use shared Compose to select Map, Results,
or Members. It SHALL expose the selected choice to accessibility services
and preserve the existing iOS map, filters, host card navigation and member
search state.

#### Scenario: Switch across Search displays

- **GIVEN** a signed-in member opens Search
- **WHEN** they choose Results and then Members
- **THEN** the corresponding offer and member search controls are available
- **AND** returning to Map and then Members preserves the member query and results
