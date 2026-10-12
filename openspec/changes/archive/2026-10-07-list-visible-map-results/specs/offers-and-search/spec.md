## ADDED Requirements

### Requirement: Visible map results list

The system SHALL show a list of available offers and enabled community Nostr note threads whose pins are within the current map viewport when a member opens the Results pane. The list SHALL honour the map's content filters and author visibility rules.

#### Scenario: Open Results with visible offers

- **WHEN** a member opens Results while offer pins are visible on the map
- **THEN** the pane lists those offers with their member and offer details
- **AND** offers outside the current viewport are omitted

#### Scenario: Select a listed offer

- **WHEN** a member selects an offer from the Results list
- **THEN** the pane displays that offer's details
- **AND** the map retains its current viewport

#### Scenario: List visible community notes

- **WHEN** a member opens Results with community notes enabled and visible on the map
- **THEN** the pane lists the visible note threads grouped by their map location
- **AND** notes excluded by author visibility rules or outside the viewport are omitted

#### Scenario: Select a listed community note

- **WHEN** a member selects a community note thread from Results
- **THEN** the pane displays the existing thread view
- **AND** the map retains its current viewport

#### Scenario: Disable community notes

- **WHEN** a member disables community notes in the map content filters
- **THEN** community note threads are removed from Results

#### Scenario: Return to results

- **WHEN** a member returns from selected offer or community note details to Results
- **THEN** the pane shows the results for the current map viewport
- **AND** the map retains its current viewport

#### Scenario: Select a map pin

- **WHEN** a member selects an offer pin on the map
- **THEN** the pane displays that offer's details
