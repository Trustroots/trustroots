## MODIFIED Requirements

### Requirement: Public experience statistics

The system SHALL provide aggregate statistics for all Experiences, including
all-time and preceding-90-day totals and the number of experiences whose
author recommends or does not recommend the member described, and the number
of unique member pairs that record a real-life meeting. The aggregates SHALL
exclude individual Experience content, member identities, and visibility
status. Experiences without a recommendation SHALL be excluded from
recommendation percentages.

#### Scenario: Visitor receives public experience statistics

- **WHEN** a visitor requests the public statistics data
- **THEN** the response includes all-time and preceding-90-day counts of public and private Experiences
- **AND** includes the corresponding counts with a recommendation and a non-recommendation
- **AND** includes the corresponding counts where members met in person
- **AND** includes no individual Experience content, member identity, or visibility-status data
