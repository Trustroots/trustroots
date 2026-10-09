## ADDED Requirements

### Requirement: Explicit profile response fields

Profile responses SHALL include only explicitly approved fields. Account-owner responses SHALL preserve fields required for profile editing, account settings and blocking. Public responses SHALL omit email addresses, account settings, IP addresses, push credentials, provider credentials and unrecognised document fields. Existing sanitisation and viewer-dependent privacy rules SHALL still apply.

#### Scenario: Existing supported requests

- **WHEN** a client makes a supported request
- **THEN** the response follows the approved explicit profile response fields contract
