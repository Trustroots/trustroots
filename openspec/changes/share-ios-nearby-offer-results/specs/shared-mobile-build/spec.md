## ADDED Requirements

### Requirement: Regular iOS nearby offers use a shared results list

The regular iOS Search Results display SHALL use shared Compose to show offers
for the same area and filters as the map, with accessible rows and loading,
empty and retry states. Native adapters SHALL retain MapKit, location, loading
and navigation to host details and profiles.

#### Scenario: Switch displays after selecting an offer

- **GIVEN** a member has entered a place query and chosen Results
- **WHEN** they select an offer and switch between Search displays
- **THEN** the place query and applicable offer selection are retained
- **AND** host details and the member profile remain reachable

#### Scenario: Refresh results for the current area and filters

- **GIVEN** the member changes the area or filters while an offer request is pending
- **WHEN** the latest request completes
- **THEN** the list displays the latest matching offers or an empty state
- **AND** a failed request can be retried for the current area and filters
