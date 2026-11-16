## ADDED Requirements

### Requirement: City hosting results

When a member chooses a city in web place search, the system SHALL open the Results pane on desktop and mobile. It SHALL list eligible offers for members who can or may host in the geocoded search area, independent of the viewport size. The list SHALL honour existing activity, language, circle and offer visibility rules.

#### Scenario: Select a city in place search

- **WHEN** a member chooses a city suggestion or submits a city search that resolves to a city
- **THEN** the Results pane opens with the city's hosting offers
- **AND** the member can open an offer and return to the city results

#### Scenario: City has a centre only

- **WHEN** the geocoder returns a city centre without bounds
- **THEN** results use a fixed area around that centre

#### Scenario: Return to map browsing

- **WHEN** a member closes the city results
- **THEN** the map retains its location and the Results pane reverts to viewport-based browsing
