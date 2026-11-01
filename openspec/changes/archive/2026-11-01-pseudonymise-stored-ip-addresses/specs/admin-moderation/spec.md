## MODIFIED Requirements

### Requirement: Member search and role filtering

The system SHALL let authorised administrators search for members and list
members with a selected moderation role. Search queries SHALL ignore leading
and trailing whitespace, and whitespace between query words SHALL be optional
when matching stored member data. Member collections SHALL be paginated and
server-side sortable by name, username, email address, signup date, or current
IP identifier. The selected sort order SHALL be retained while an administrator
moves between pages.

#### Scenario: Administrator searches for a member

- **WHEN** an authorised administrator searches using a valid member query
- **THEN** the first page of matching member records is displayed

#### Scenario: Administrator searches with surrounding whitespace

- **WHEN** an authorised administrator searches using a valid member query
  with leading or trailing whitespace
- **THEN** the system searches using the trimmed query

#### Scenario: Administrator searches with spacing between words

- **WHEN** an authorised administrator searches using words separated by
  whitespace
- **THEN** matching member data is returned whether it stores whitespace
  between those words or not

#### Scenario: Administrator filters members by role

- **WHEN** an authorised administrator selects a moderation role
- **THEN** the first page of members with that role is displayed

#### Scenario: Administrator opens a role list URL

- **WHEN** an authorised administrator opens `/admin/search-users?role=<role>` for a valid role
- **THEN** the first page of members with that role is displayed
- **AND** the selected role is visible in the role filter
- **AND** the URL retains the role while the administrator changes pages or sorting

#### Scenario: Administrator follows a member role link

- **WHEN** an administrator selects the Greeter or volunteer role on a member record
- **THEN** the application opens the corresponding role-filtered member list at its unique URL

#### Scenario: Administrator sorts member search results

- **WHEN** an authorised administrator selects a member-table column header
- **THEN** the displayed member collection is sorted by that column on the server
- **AND** selecting the active header again reverses the sort direction

#### Scenario: Administrator opens another member-list page

- **WHEN** an authorised administrator selects a subsequent or previous page
- **THEN** the system displays that page of the same member collection
- **AND** retains the selected sort column and direction

#### Scenario: Administrator submits an invalid search or role

- **WHEN** an authorised administrator submits an invalid member search or role
- **THEN** the system explains that the request is invalid

### Requirement: Current IP address moderation context

The system SHALL retain only a keyed identifier of the current client IP address observed during a member's authenticated activity. It SHALL make matching by that identifier available only to authorised administrators in member-search results and member reports. Raw addresses SHALL not appear in those responses.

#### Scenario: Member performs authenticated activity

- **WHEN** a member performs authenticated activity from a valid client IP address and a hashing key is configured
- **THEN** the system records the member's current client IP identifier
- **AND** replaces any previously stored identifier for that member

#### Scenario: Administrator views a member

- **WHEN** an authorised administrator views a member in a search result or member report
- **THEN** the system offers a descriptive same-IP matching action when an identifier is available
- **AND** neither the raw address nor its identifier is displayed as the action label

#### Scenario: Administrator follows an IP address

- **WHEN** an authorised administrator selects the same-IP matching action
- **THEN** the system displays members whose current stored identifier exactly matches

#### Scenario: Regular member requests an IP-address lookup

- **WHEN** a regular member requests the administrator IP matching lookup
- **THEN** the system denies access

### Requirement: Compact audit history

The admin audit log SHALL display compact rows containing time, acting member,
request route and a concise summary. Empty request fields and pagination fields
SHALL be omitted from summaries. Stored body, params, query, keyed staff IP identifier and log ID
SHALL remain available through expandable details. Raw IP search fields SHALL be
omitted from newly stored body and query payloads. Legacy raw address fields SHALL
be removed by the documented migration.

#### Scenario: Request summary

- **WHEN** an entry contains an empty userId, a username and pagination criteria
- **THEN** its summary shows the username without empty or pagination fields
- **AND** its stored request data remains available in expandable details
