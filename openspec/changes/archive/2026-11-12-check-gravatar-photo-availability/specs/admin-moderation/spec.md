## ADDED Requirements

### Requirement: Gravatar photo availability check

Administrators SHALL be able to explicitly start a read-only check from `/admin/gravatar` for accounts whose current avatar source is Gravatar. The server SHALL pace requests to Gravatar and report aggregate counts for images available, images unavailable and inconclusive checks. The API SHALL restrict access to administrators and SHALL NOT expose email addresses, hashes or member-level results.

#### Scenario: Administrator checks photo availability

- **WHEN** an administrator starts a check
- **THEN** the page shows progress and the counts by outcome
- **AND** refreshing the page can recover the results while the serving process is running
- **AND** a check already running in that process is reused
- **AND** member profiles are unchanged

#### Scenario: Gravatar responds to an image request

- **WHEN** Gravatar returns an image response, a 404 for a request with the default image disabled, or another outcome
- **THEN** the check records an available image, no available image, or an inconclusive result respectively
- **AND** timeouts, invalid or missing hashes and unexpected responses are inconclusive

#### Scenario: Visitor or non-admin requests the photo check

- **WHEN** a visitor or non-admin tries to start or view a check
- **THEN** the API denies the request
