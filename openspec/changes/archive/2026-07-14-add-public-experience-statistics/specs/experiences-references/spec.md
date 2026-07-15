## ADDED Requirements

### Requirement: Public experience statistics

The system SHALL provide aggregate statistics for publicly visible
experiences, including all-time and preceding-90-day totals and the number of
experiences whose author recommends or does not recommend the member
described, and the number of unique member pairs that record a real-life
meeting. The aggregates SHALL exclude private experiences and individual
experience content. Experiences without a recommendation SHALL be excluded
from recommendation percentages.

#### Scenario: Visitor receives public experience statistics

- **WHEN** a visitor requests the public statistics data
- **THEN** the response includes all-time and preceding-90-day counts of public experiences
- **AND** includes the corresponding counts with a recommendation and a non-recommendation
- **AND** includes the corresponding counts where members met in person
- **AND** includes no individual experience, member, or private-experience data
