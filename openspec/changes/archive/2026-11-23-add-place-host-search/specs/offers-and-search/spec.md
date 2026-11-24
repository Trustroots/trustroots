## ADDED Requirements

### Requirement: City-based host results

The system SHALL open a scrollable host list when a member selects a city. The list SHALL use the geocoded city's bounds independently of the map viewport and apply offer eligibility, member visibility and supported search filters.

#### Scenario: Select a city on any screen size

- **WHEN** a member selects a city on desktop or mobile
- **THEN** the member sees eligible hosting offers inside that city's search area
- **AND** the member can switch to results for the current map area

#### Scenario: Compare and sort eligible hosts

- **WHEN** the member browses city results
- **THEN** each row shows the member's identity, hosting status, age if available, approximate distance from the centre, coarse activity and visible public Experience count
- **AND** results initially sort by name and can sort by recent activity or public Experience count
- **AND** the member can limit the list to hosts who can host

#### Scenario: Return from an offer

- **WHEN** the member opens a hosting offer and returns to the results
- **THEN** the city, sort, filter and loaded results remain available
