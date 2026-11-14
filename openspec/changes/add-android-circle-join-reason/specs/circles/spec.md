## ADDED Requirements

### Requirement: Android circle detail join reason

An Android member joining from circle detail SHALL be able to provide an optional reason of up to 160 characters on a single line. The field SHALL explain who can read the reason.

#### Scenario: Android member enters a reason

- **WHEN** a member enters a reason on Android circle detail and taps Join circle
- **THEN** the app submits the trimmed reason with the membership request

#### Scenario: Android member leaves the reason blank

- **WHEN** a member taps Join circle with the reason blank
- **THEN** the app submits the membership request without a reason
