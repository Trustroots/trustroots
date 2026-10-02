## ADDED Requirements

### Requirement: FAQ category filtering

The system SHALL let a visitor filter the questions on the open FAQ category
page using a case-insensitive phrase found in a question or its answer.

#### Scenario: Visitor filters FAQ questions

- **WHEN** a visitor enters a phrase in the FAQ filter
- **THEN** only matching questions in the open category are shown
- **AND** other FAQ categories remain available through the sidebar

#### Scenario: No FAQ question matches

- **WHEN** the entered phrase matches no question or answer in the open category
- **THEN** the page explains that there are no matching questions

#### Scenario: Visitor clears the FAQ filter

- **WHEN** a visitor clears the filter
- **THEN** all questions in the open category are shown again
