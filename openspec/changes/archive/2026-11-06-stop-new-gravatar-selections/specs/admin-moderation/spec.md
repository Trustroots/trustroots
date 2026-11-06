## ADDED Requirements

### Requirement: Gravatar usage inspection

Administrators SHALL be able to open `/admin/gravatar` to see the total number of accounts whose current avatar source is Gravatar, the measurement time in UTC and a paginated list linking to their admin member pages. The page SHALL NOT fetch Gravatar images or change accounts. The API SHALL restrict access to administrators and return only member IDs, usernames and display names alongside pagination and measurement metadata.

#### Scenario: Administrator inspects current usage

- **WHEN** an administrator opens the Gravatar page
- **THEN** the page shows the current count and up to 50 members per page in stable order
- **AND** members who have switched away are excluded

#### Scenario: No remaining Gravatar accounts

- **WHEN** no accounts select Gravatar
- **THEN** the page displays a zero count and an empty-state message

#### Scenario: Unauthorised access

- **WHEN** a visitor or non-admin requests the Gravatar member API
- **THEN** access is denied and no count or member data is returned
