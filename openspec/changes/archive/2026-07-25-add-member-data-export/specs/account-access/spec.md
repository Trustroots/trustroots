## ADDED Requirements

### Requirement: Member data export

The system SHALL let an authenticated member download an unsigned, versioned
JSON file containing their profile, contacts, and hosting offers.

#### Scenario: Member downloads their data

- **WHEN** an authenticated member requests their data export
- **THEN** the system returns a JSON attachment with format
  `trustroots-data-export`, version `1`, an export timestamp, and `profile`,
  `contacts`, and `hostingOffers` sections

#### Scenario: Unauthenticated visitor requests an export

- **WHEN** an unauthenticated visitor requests the data-export endpoint
- **THEN** the system refuses the request
