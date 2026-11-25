## ADDED Requirements

### Requirement: Native search switches between the map and member search

The native search switch SHALL offer both the map and member search. Members
SHALL be able to submit a name, username, location or tagline, with optional
hosting, meetings, volunteering, connections, recent activity, circle and
language filters. The system SHALL use the member-search visibility rules.

#### Scenario: Filter member search from the map

- **GIVEN** a signed-in member is using native map search
- **WHEN** the member switches to Members and submits text with filters
- **THEN** the list shows members matching the text and filters
- **AND** the member can switch back to their map search

### Requirement: Native offer search cards show availability

Native offer result and detail cards SHALL show positive or tentative
meeting availability and whether the offer includes volunteering.

#### Scenario: A host also welcomes meetings and volunteers

- **WHEN** a member reviews an offer with hosting, meeting and volunteering availability
- **THEN** the result and detail cards show the applicable availability indicators
