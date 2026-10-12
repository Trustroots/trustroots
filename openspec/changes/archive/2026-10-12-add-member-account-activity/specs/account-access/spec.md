## ADDED Requirements

### Requirement: Member account activity events

The system SHALL record successful account-access and credential lifecycle events with a stable identifier, event type, owning member and timestamp. It SHALL exclude credentials, private content and unnecessary personal identifiers.

#### Scenario: Credential transition succeeds

- **WHEN** a supported account credential transition completes
- **THEN** exactly one corresponding event becomes available despite delivery retries

#### Scenario: Event delivery temporarily fails

- **WHEN** recording the activity event is temporarily unavailable
- **THEN** the completed account operation remains committed
- **AND** the system retries or reports the recording failure without logging credentials

### Requirement: Private bounded activity history

The system SHALL expose only the signed-in member's activity with opaque cursor pagination and no-store responses. Events SHALL have a 90-day retention policy, and account removal SHALL delete their history.

#### Scenario: Member reads their history

- **WHEN** an authenticated member opens account activity
- **THEN** the response contains only their supported events
- **AND** each page contains no more than 50 entries

#### Scenario: History cannot be loaded

- **WHEN** the history service is unavailable
- **THEN** the interface reports unavailability rather than presenting an empty history

