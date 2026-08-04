## MODIFIED Requirements

### Requirement: Member search and role filtering

The system SHALL let authorised administrators search for members and list
members with a selected moderation role. Search queries SHALL ignore leading
and trailing whitespace, and whitespace between query words SHALL be optional
when matching stored member data. The resulting member table SHALL allow the
administrator to sort by name, username, email address, or signup date.

#### Scenario: Administrator searches for a member

- **WHEN** an authorised administrator searches using a valid member query
- **THEN** matching member records are displayed

#### Scenario: Administrator searches with surrounding whitespace

- **WHEN** an authorised administrator searches using a valid member query
  with leading or trailing whitespace
- **THEN** the system searches using the trimmed query

#### Scenario: Administrator searches with spacing between words

- **WHEN** an authorised administrator searches using words separated by
  whitespace
- **THEN** matching member data is returned whether it stores whitespace
  between those words or not

#### Scenario: Administrator sorts member search results

- **WHEN** an authorised administrator selects a member-table column header
- **THEN** the displayed results are sorted by that column
- **AND** selecting the active header again reverses the sort direction

#### Scenario: Administrator filters members by role

- **WHEN** an authorised administrator selects a moderation role
- **THEN** members with that role are displayed

#### Scenario: Administrator submits an invalid search or role

- **WHEN** an authorised administrator submits an invalid member search or role
- **THEN** the system explains that the request is invalid
