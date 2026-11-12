## MODIFIED Requirements

### Requirement: Gravatar usage inspection

Administrators SHALL be able to open `/admin/gravatar` to see the total number of accounts whose current avatar source is Gravatar, the measurement time in UTC and a paginated list linking to their admin member pages. The list SHALL show the recorded last-seen timestamp in UTC when available and indicate when it is unknown. The page SHALL show profile pictures using the authenticated avatar endpoint and SHALL NOT change accounts. The report API SHALL restrict access to administrators and return only member IDs, usernames, display names and recorded last-seen timestamps alongside pagination and measurement metadata.

#### Scenario: Administrator inspects current usage

- **WHEN** an administrator opens the Gravatar page
- **THEN** the page shows the current count and up to 50 members per page in stable order
- **AND** profile pictures appear beside usernames, including for non-public profiles
- **AND** members who have switched away are excluded

#### Scenario: Administrator sorts the list

- **WHEN** an administrator sorts by username, display name or last-seen time
- **THEN** the page returns to page one and the chosen order applies across the full result set before pagination
- **AND** selecting the same column again reverses the order
- **AND** unknown last-seen times sort after recorded times in either direction

#### Scenario: No remaining Gravatar accounts

- **WHEN** no accounts select Gravatar
- **THEN** the page displays a zero count and an empty-state message

#### Scenario: Unauthorised access

- **WHEN** a visitor or non-admin requests the Gravatar member API
- **THEN** access is denied and no count or member data is returned
