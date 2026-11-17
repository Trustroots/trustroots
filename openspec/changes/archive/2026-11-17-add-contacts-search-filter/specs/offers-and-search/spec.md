## ADDED Requirements

### Requirement: Search connections

Web map search and member search SHALL let a signed-in member limit results to their confirmed contacts and people with a positive Experience in either direction. Pending contact requests and neutral Experiences SHALL NOT qualify on their own. A visible negative Experience in either direction SHALL exclude that member. A member's own Experiences and published incoming Experiences SHALL be considered while Experiences removed by moderation and private incoming recommendations SHALL be ignored. Existing profile and offer visibility rules SHALL still apply.

#### Scenario: Find connections with visible map offers

- **WHEN** a member enables the connections map filter
- **THEN** the map and Results pane show matching visible offers from eligible connections, including eligible meetings from members who cannot host
- **AND** community notes are hidden while the filter is active

#### Scenario: Find connections without map offers

- **WHEN** a member enables the connections filter and searches using an eligible connection's public profile details
- **THEN** the matching connection appears regardless of their hosting status or whether they have an offer

#### Scenario: A negative Experience overrides a contact or positive Experience

- **WHEN** either member has shared a negative Experience visible to the searching member
- **THEN** that pair is excluded even if the pair has a confirmed contact or a positive Experience

#### Scenario: Clear the filter

- **WHEN** a member turns off the connections filter
- **THEN** ordinary search resumes with their other filters intact
