## ADDED Requirements

### Requirement: iOS offer map uses shared map actions

The regular iOS offer map SHALL display accessible Search filters and Use
current location buttons in Compose with 44-point hit targets. Search filters
SHALL open the existing filter sheet. Use current location SHALL call the
native location manager so its permission and error handling apply. The
separate button hosts SHALL leave the surrounding map available for gestures.

#### Scenario: Open filters from the map actions

- **GIVEN** a member is viewing the regular iOS offer map
- **WHEN** they select Search filters
- **THEN** the existing filter sheet appears and closing it returns to the same map
