## ADDED Requirements

### Requirement: Android profile activity statistics

The native Android app SHALL show available last-active, reply-rate and reply-time facts on a member profile. It SHALL show available last-active and reply-rate facts on a host result card. Missing or invalid facts SHALL be omitted without preventing the remaining profile or card content from appearing, and missing reply statistics SHALL NOT be presented as a zero rate.

#### Scenario: Member views a profile with activity statistics

- **WHEN** the profile response includes a valid last-seen timestamp and reply statistics
- **THEN** the profile shows labelled, localised last-active and reply facts
- **AND** the host result card shows the available last-active and reply-rate facts

#### Scenario: Member views a profile with missing or invalid statistics

- **WHEN** profile activity or reply statistics are absent, blank or invalid
- **THEN** Android omits the unavailable facts and keeps the rest of the profile and host card available
- **AND** it does not show a missing reply rate as zero
