## ADDED Requirements

### Requirement: Consistent Android search and filter controls

The Android circle and conversation filters and member and place searches SHALL
use fully rounded filled text fields. Live filters SHALL show a leading search
icon. Submitted searches SHALL show a trailing fully rounded theme-primary search
button and support the keyboard search action. Non-empty fields SHALL show a
Clear icon button before any search button. Field and action labels SHALL use
XML string resources, and icon buttons SHALL have accessible names and touch
targets of at least 48 dp. Existing search-mode menus SHALL remain available.

#### Scenario: Clearing a live filter

- **WHEN** a member clears the circle or conversation filter
- **THEN** the full loaded list returns immediately without another API request
- **AND** the empty field no longer shows its Clear action

#### Scenario: Clearing submitted member search

- **WHEN** a member clears the member search field
- **THEN** its results and search errors are removed without submitting a search
- **AND** a late response for the old query cannot restore results or errors
- **AND** authentication failures still invalidate the member's session

#### Scenario: Clearing place search

- **WHEN** a member clears the place search field
- **THEN** place suggestions are dismissed without submitting an empty search
- **AND** the current map, host results and filters remain in place
- **AND** a late submitted lookup cannot move the map or show an obsolete error

#### Scenario: Submitting through keyboard or button

- **WHEN** a valid search is submitted with the keyboard or the search button
- **THEN** the same search action runs
- **AND** neither action submits when the screen disables search
