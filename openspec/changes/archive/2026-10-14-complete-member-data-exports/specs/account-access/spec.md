## MODIFIED Requirements

### Requirement: Member data export

The system SHALL let an authenticated member download an unsigned, versioned
JSON file containing their profile, the circles they belong to, their contacts,
their hosting and meet offers (including expired offers still stored), and the
messages and experiences they have written. The download filename SHALL be
`trustroots-data-<username>-<yyyymmdd>-<hhmm>.json`, using the member's
username and the UTC time of the export. When the username is not safe to
place in a filename, the system SHALL omit it and use
`trustroots-data-<yyyymmdd>-<hhmm>.json`.

#### Scenario: Member downloads their data

- **WHEN** an authenticated member requests their data export
- **THEN** the system returns a JSON attachment named with that member's
  username and the UTC export time, with format `trustroots-data-export`,
  version `1`, an export timestamp, and `profile`, `circles`, `contacts`,
  `hostingOffers`, `messages`, and `experiences` sections

#### Scenario: Unauthenticated visitor requests an export

- **WHEN** an unauthenticated visitor requests the data-export endpoint
- **THEN** the system refuses the request
