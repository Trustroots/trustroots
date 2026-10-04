## ADDED Requirements

### Requirement: Compact audit history

The admin audit log SHALL display compact rows containing time, acting member,
request route and a concise summary. Empty request fields and pagination fields
SHALL be omitted from summaries. Raw body, params, query, IP address and log ID
SHALL remain available through expandable details without changing stored logs.

#### Scenario: Request summary

- **WHEN** an entry contains an empty userId, a username and pagination criteria
- **THEN** its summary shows the username without empty or pagination fields
- **AND** its full request data remains available in expandable details

### Requirement: Audit actor filters

Administrators SHALL filter audit history by the staff username that performed
the action and by current admin or welcome-team membership. Combined filters
SHALL intersect. Filters SHALL apply before the latest 100 entries are selected.
Username options SHALL include existing actors from all recorded history.
The existing response array and admin-only access SHALL remain compatible.

#### Scenario: Older matching staff activity

- **WHEN** an administrator filters by an actor whose records precede the latest
  100 unfiltered entries
- **THEN** the actor's latest matching entries are returned

#### Scenario: Team and username filters

- **WHEN** an administrator selects a username and a team
- **THEN** only that actor's entries are returned if they currently belong to that team
- **AND** members holding both roles match either team

#### Scenario: Invalid or missing results

- **WHEN** an invalid team or non-string filter is supplied
- **THEN** the API rejects the filter
- **WHEN** no actors match valid filters
- **THEN** the list returns an empty array
