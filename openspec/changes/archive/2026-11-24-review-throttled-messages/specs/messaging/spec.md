## ADDED Requirements

### Requirement: Preserve the recipient-limit review window

When a throttle hit claims a Support alert, the system SHALL save an immutable
review identifier, sender identifier, and the exact window used to count
recipients. The alert email SHALL link to that review without including message
content or recipient identities. The review SHALL survive subsequent alert
claims independently of the email cooldown.

#### Scenario: The same sender triggers a later alert

- **WHEN** a later throttle hit claims a new Support alert
- **THEN** each alert link continues to identify its own recorded window
