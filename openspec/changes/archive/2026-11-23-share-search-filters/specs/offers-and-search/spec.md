## ADDED Requirements

### Requirement: Share web search criteria

Web map and member search SHALL reflect applied search criteria in URL query parameters and restore those criteria when a link opens.

#### Scenario: Open a filtered search link

- **WHEN** a member opens a web search link carrying a query and filter settings
- **THEN** the page applies those criteria and displays the corresponding control states

### Requirement: Consistent web search filters

Web map and member search SHALL use consistent keyboard-accessible switches and the map SHALL display subdued counts of result markers within the visible viewport.

#### Scenario: Review map counts

- **WHEN** enabled map layers have loaded
- **THEN** their filter rows show counts for the markers in the current viewport, counting results grouped in clusters individually

#### Scenario: Narrow member search

- **WHEN** a member applies availability, volunteering, activity, circle, language or connection criteria
- **THEN** member search applies those criteria before ranking and limiting discoverable results
