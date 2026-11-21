## ADDED Requirements

### Requirement: Counts in the public Experience summary

The web profile summary SHALL count public primary Experiences and omit
attached replies and pending Experiences from its totals.

#### Scenario: Public Experiences include unanswered and overlapping categories

- **WHEN** the detailed summary displays recommendation and interaction counts
- **THEN** missing answers are reported separately and are not counted as negative answers
- **AND** a public Experience may contribute to multiple reported interaction counts
- **AND** the existing gender breakdown counts other or unlisted values together when any of the displayed categories applies
