## ADDED Requirements

### Requirement: Native maps and offer results use the same search

Android and iOS offer search SHALL allow switching between the viewport map
and textual offer results while preserving the current place and filters.
Both platforms SHALL support filtering by offer type, circle, language,
recent activity, volunteering and connections. The server SHALL continue to
apply its existing offer visibility rules.

#### Scenario: Switch between native map and results

- **GIVEN** a member has filtered offers in a selected area
- **WHEN** the member switches between map and results
- **THEN** both views show the same matching offers
- **AND** the member can open a result's offer details
