## MODIFIED Requirements

### Requirement: Public experience statistics

The system SHALL provide aggregate statistics for all Experiences, including
all-time and preceding-90-day totals and the number of experiences whose
author recommends or does not recommend the member described, and the number
of unique member pairs that record a real-life meeting. The system SHALL also
provide all-time and preceding-90-day counts of message conversations whose
first message received a reply, and the positive rate of the latest available
message feedback for replied member pairs. The aggregates SHALL exclude
individual Experience content, message content, member identities, and
visibility status. Experiences without a recommendation and replied threads
without message feedback SHALL be excluded from their respective percentage
denominators.

#### Scenario: Visitor receives public experience statistics

- **WHEN** a visitor requests the public statistics data
- **THEN** the response includes all-time and preceding-90-day counts of public and private Experiences
- **AND** includes the corresponding counts with a recommendation and a non-recommendation
- **AND** includes the corresponding counts where members met in person
- **AND** includes all-time and preceding-90-day counts of conversations whose first message received a reply
- **AND** includes positive and negative latest-feedback counts for replied member pairs
- **AND** includes no individual Experience content, message content, member identity, or visibility-status data
