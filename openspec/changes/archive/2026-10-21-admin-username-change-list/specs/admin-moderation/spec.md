## ADDED Requirements

### Requirement: Username change history

The system SHALL retain each successful username change as an old/new pair
with its timestamp. A failed username update SHALL NOT append history. Username
history SHALL be private and available only through admin-authorised tools. The
system SHALL NOT expose it through public or member profile responses.
Administrators SHALL be able to inspect changes from the previous 90 days or
all available history. The default list SHALL cover the previous 90 days and
return at most 50 changes per page, ordered by change time descending and
member ID ascending to break ties. It SHALL show each member's current username
linked to their admin report, optional display name, old and new usernames,
and exact UTC change time. Historical members whose previous username is
unknown SHALL show that value as unavailable, never fabricated.

#### Scenario: Username changes successfully

- **WHEN** an eligible member successfully changes their username
- **THEN** the former and new usernames and change time are saved atomically
- **AND** the member's current username and existing change timestamp are
  updated in that same save

#### Scenario: Username change fails

- **WHEN** a username change fails validation or persistence
- **THEN** no username history entry is saved

#### Scenario: Administrator opens recent username changes

- **WHEN** an authorised administrator opens `/admin/username-changes`
- **THEN** the page lists changes from the previous 90 days by default
- **AND** shows the member's current username, optional display name, old and
  new usernames, and exact UTC times
- **AND** links each current username to its admin member report

#### Scenario: Administrator chooses all available history

- **WHEN** an administrator selects the all-time history range
- **THEN** the page includes every recorded username change
- **AND** includes legacy `usernameUpdated` timestamps with the old username
  unavailable when no recorded history exists

#### Scenario: Administrator pages through changes

- **WHEN** more than 50 username changes match the selected range
- **THEN** the API returns pages of at most 50 changes
- **AND** each page continues the same descending-time order with stable ID
  tie-breaking

#### Scenario: Regular member requests recent username changes

- **WHEN** a regular member requests the username changes page or API
- **THEN** the system denies access

#### Scenario: Administrator reviews a historical timestamp without a prior name

- **WHEN** a historical timestamp has no corresponding username history
- **THEN** the interface identifies the previous username as unavailable
- **AND** does not infer a previous username from the current one
