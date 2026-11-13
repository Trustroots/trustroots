## ADDED Requirements

### Requirement: Public statistics charts

The statistics page SHALL render MongoDB-backed charts and aggregate counts without requesting Grafana assets. The public `GET /api/statistics/charts` endpoint SHALL serve a session-independent response and cache successful results for one hour. Each application process SHALL share a single refresh across concurrent requests and wait at least one minute after a failed refresh before trying again.

#### Scenario: Visitor views weekly trends

- **WHEN** a visitor opens the statistics page
- **THEN** the page displays signups, conversations started and first replies for the 12 most recent completed Monday-to-Sunday UTC weeks
- **AND** weeks without matching records are shown as zero

#### Scenario: Visitor views current member activity

- **WHEN** a visitor opens the statistics page
- **THEN** the page displays member counts based on each account’s latest activity timestamp for the preceding 7, 14 and 30 days and 6 and 12 months

#### Scenario: Refresh fails after a successful response

- **WHEN** a chart refresh fails
- **THEN** the endpoint continues serving the last successful response for up to 24 hours from its refresh time

#### Scenario: Chart data is unavailable

- **WHEN** a chart refresh fails and there is no usable cached response
- **THEN** the endpoint returns a non-cacheable 503 with a retry interval
- **AND** the page shows that chart data is unavailable and continues to display the other available statistics and the volunteering link
