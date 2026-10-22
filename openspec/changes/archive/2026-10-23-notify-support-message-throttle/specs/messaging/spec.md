## ADDED Requirements

### Requirement: Support notification for message throttling

The system SHALL queue a plain-text notification to the configured support
inbox when a non-exempt member hits the existing message recipient throttle.
It SHALL allow at most one queued alert per member in a rolling 24-hour window
across concurrent requests and application instances. The notification SHALL
contain the username, admin profile link, UTC timestamp, distinct-recipient
count and configured limit, without message contents or recipient identities.
Alert errors SHALL be logged without changing the HTTP 429 response. A failed
queue operation SHALL release its claim so a later throttle hit can retry.

#### Scenario: Member first hits the throttle

- **WHEN** a member's message is rejected by the recipient throttle
- **THEN** a support email is queued and the request returns HTTP 429

#### Scenario: Repeated or concurrent throttle hits

- **WHEN** the same member hits the throttle repeatedly or concurrently
- **THEN** only one email is queued during the member's rolling 24-hour window
- **AND** a later hit after that window may queue another alert

#### Scenario: Notification storage or queuing fails

- **WHEN** notification storage or email queuing fails
- **THEN** the message remains rejected with HTTP 429 and the error is logged
- **AND** failed email queuing does not consume the member's alert cooldown

#### Scenario: Sending remains below the limit or exempt

- **WHEN** a sender does not hit the throttle or has an exempt role
- **THEN** no throttle alert is created
