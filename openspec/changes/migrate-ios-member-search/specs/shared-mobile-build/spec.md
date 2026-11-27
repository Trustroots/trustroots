## ADDED Requirements

### Requirement: Regular iOS member search uses shared Compose

The regular iOS member search SHALL use shared Compose for query entry,
filters, results and request states while using the existing iOS API and
profile navigation. The screen SHALL preserve the query and last results when
the member opens and returns from a profile or switches between member and
offer search modes. Submitting a valid query SHALL dismiss the keyboard; the
keyboard SHALL also have an explicit dismissal action. Changing filters after
a completed search SHALL refresh results when the filter screen closes. The
screen SHALL expose accessible labels and identifiers for query entry,
filters, retry and result selection.

#### Scenario: Search, open a profile and return

- **GIVEN** a member has submitted a search and results are displayed
- **WHEN** they open a result profile and return to member search
- **THEN** the query and results remain displayed

#### Scenario: Switch between member and offer search

- **GIVEN** a member has submitted a member search
- **WHEN** they switch to offer search and back to member search
- **THEN** the query and results remain displayed

#### Scenario: Change filters after searching

- **GIVEN** a member has completed a search
- **WHEN** they change one or more filters and close the filter screen
- **THEN** the existing query is searched again with the updated filters

#### Scenario: Search request states

- **WHEN** member search has not started, is loading, returns no matches,
  returns matches or fails
- **THEN** the screen shows its corresponding initial, loading, empty,
  populated or retryable error state

#### Scenario: Search controls are used with accessibility services

- **WHEN** a member navigates the search screen with accessibility services
- **THEN** the query, filters, retry action and each selectable result have
  descriptive accessible names
