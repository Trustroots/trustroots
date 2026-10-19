## ADDED Requirements

### Requirement: Member experience statistics

The admin member report SHALL show received and written experience totals and
separate counts of published positive, negative and neutral recommendations
and unpublished experiences. Removed experiences SHALL be excluded. Statistics
SHALL use a consistent responsive layout and show zero for empty categories.

#### Scenario: Administrator inspects a member with experiences

- **WHEN** an administrator opens a member report with published, unpublished and removed experiences
- **THEN** received and written totals include active experiences only
- **AND** recommendation counts include published experiences only
- **AND** unpublished counts appear separately

#### Scenario: Administrator inspects a member without experiences

- **WHEN** an administrator opens a member report without experiences
- **THEN** all experience counts are zero
- **AND** activity cards remain readable at desktop and mobile widths
