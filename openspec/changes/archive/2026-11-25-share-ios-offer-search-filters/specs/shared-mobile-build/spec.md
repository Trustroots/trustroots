## ADDED Requirements

### Requirement: iOS offer search uses shared filter controls

The regular iOS offer search SHALL render its offer type, activity, language and
Circle filter controls in shared Compose. The iOS host SHALL continue to apply
the filters to Map and Results and provide the existing language picker, Reset
and Done actions.

#### Scenario: Apply connected volunteering filters

- **GIVEN** a member opens Search filters while viewing offers
- **WHEN** they enable volunteering and connections-only and close the sheet
- **THEN** hosting is enabled, Community Notes are suppressed and both Map and Results use the selected filters

#### Scenario: Reset the offer filters

- **GIVEN** a member changes the offer filters
- **WHEN** they select Reset
- **THEN** the defaults restore and the filter controls show those defaults
